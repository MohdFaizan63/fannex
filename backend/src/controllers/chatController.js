const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const CreatorProfile = require('../models/CreatorProfile');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Earnings = require('../models/Earnings');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SETTINGS (Creator only)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Get creator's own chat settings
// @route GET /api/v1/chat/creator/settings
// @access Creator
const getChatSettings = async (req, res, next) => {
    try {
        const profile = await CreatorProfile.findOne({ userId: req.user._id }).select(
            'chatEnabled chatPrice minGift maxGift'
        );
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found' });
        res.json({ success: true, data: profile });
    } catch (err) { next(err); }
};

// @desc  Update chat pricing settings
// @route PATCH /api/v1/chat/creator/settings
// @access Creator
const updateChatSettings = async (req, res, next) => {
    try {
        const { chatEnabled, chatPrice, minGift, maxGift } = req.body;

        // Use findOne + save to avoid runValidators triggering unrelated schema constraints
        const profile = await CreatorProfile.findOne({ userId: req.user._id });
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found' });

        if (chatEnabled !== undefined) profile.chatEnabled = chatEnabled;
        if (chatPrice !== undefined) profile.chatPrice = Number(chatPrice);
        if (minGift !== undefined) profile.minGift = Number(minGift);
        if (maxGift !== undefined) profile.maxGift = Number(maxGift);

        await profile.save({ validateModifiedOnly: true });

        res.json({
            success: true,
            data: {
                chatEnabled: profile.chatEnabled,
                chatPrice: profile.chatPrice,
                minGift: profile.minGift,
                maxGift: profile.maxGift,
            },
        });
    } catch (err) {
        console.error('updateChatSettings error:', err.message);
        next(err);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// CHAT UNLOCK (User)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Razorpay order to unlock a chat room
// @route POST /api/v1/chat/unlock
// @access User (logged in)
const createChatUnlockOrder = async (req, res, next) => {
    try {
        const { creatorId } = req.body;
        const userId = req.user._id;

        // Check existing room
        const existing = await ChatRoom.findOne({ creatorId, userId });
        if (existing?.isPaid) {
            return res.json({ success: true, alreadyUnlocked: true, chatId: existing._id });
        }

        // Get creator's chat price
        const profile = await CreatorProfile.findOne({ userId: creatorId }).select('chatPrice chatEnabled displayName');
        if (!profile) {
            return res.status(400).json({ success: false, message: 'Creator not found' });
        }
        // Allow chat unlock if price is set (> 0) OR chatEnabled is explicitly true
        const chatAvailable = profile.chatEnabled || (profile.chatPrice && profile.chatPrice > 0);
        if (!chatAvailable) {
            return res.status(400).json({ success: false, message: 'Chat not available for this creator' });
        }

        const chatPrice = profile.chatPrice || 199;
        const amountPaise = Math.round(chatPrice * 100);

        // Razorpay requires at minimum ₹1 (100 paise)
        if (amountPaise < 100) {
            return res.status(400).json({ success: false, message: 'Chat price must be at least ₹1.' });
        }

        // Validate Razorpay is configured
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ success: false, message: 'Payment gateway not configured. Contact support.' });
        }

        // Razorpay receipt has a 40-char limit — keep it short
        const receipt = `cu_${String(userId).slice(-8)}_${Date.now().toString().slice(-8)}`;

        let order;
        try {
            order = await razorpay.orders.create({
                amount: amountPaise,
                currency: 'INR',
                receipt,
                notes: { type: 'chat_unlock', creatorId: String(creatorId), userId: String(userId) },
            });
        } catch (rzpErr) {
            // Extract a human-readable message from Razorpay's error format
            const description =
                rzpErr?.error?.description ||
                rzpErr?.error?.reason ||
                rzpErr?.message ||
                'Razorpay order creation failed';
            console.error('[chatController] Razorpay order error:', rzpErr?.error || rzpErr);
            return res.status(502).json({ success: false, message: `Payment gateway error: ${description}` });
        }

        // Save payment record
        await Payment.create({
            userId,
            creatorId,
            amount: profile.chatPrice,
            type: 'chat_unlock',
            razorpayOrderId: order.id,
            status: 'created',
        });

        res.json({
            success: true,
            order,
            chatPrice: profile.chatPrice,
            creatorName: profile.displayName,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) { next(err); }
};

// @desc  Verify Razorpay payment and unlock chat room
// @route POST /api/v1/chat/unlock/verify
// @access User
const verifyChatUnlock = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, creatorId } = req.body;
        const userId = req.user._id;

        // Verify signature
        const expectedSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        // Update payment record
        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, status: 'captured' },
            { returnDocument: 'after' }
        );

        // Create or unlock chat room
        const room = await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            {
                isPaid: true,
                chatPaymentId: razorpay_payment_id,
                unlockedAt: new Date(),
            },
            { upsert: true, returnDocument: 'after' }
        );

        // Update payment with chatId
        if (payment) { payment.chatId = room._id; await payment.save({ validateBeforeSave: false }); }

        // Credit creator earnings
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: payment?.amount || 0, pendingAmount: payment?.amount || 0 } },
            { upsert: true }
        );

        res.json({ success: true, chatId: room._id });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ROOMS & MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Get user's chat rooms (inbox)
// @route GET /api/v1/chat/rooms
// @access User
const getUserRooms = async (req, res, next) => {
    try {
        const rooms = await ChatRoom.find({ userId: req.user._id, isPaid: true })
            .sort({ lastMessageAt: -1 })
            .populate({ path: 'creatorId', select: 'name', model: 'User' })
            .lean();

        // Enrich with creator profile images
        const enriched = await Promise.all(rooms.map(async (r) => {
            const cp = await CreatorProfile.findOne({ userId: r.creatorId?._id }).select('displayName profileImage chatPrice username');
            return { ...r, creatorProfile: cp };
        }));

        res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
};

// @desc  Get creator's chat rooms (inbox)
// @route GET /api/v1/chat/creator/rooms
// @access Creator
const getCreatorRooms = async (req, res, next) => {
    try {
        const rooms = await ChatRoom.find({ creatorId: req.user._id, isPaid: true })
            .sort({ lastMessageAt: -1 })
            .populate({ path: 'userId', select: 'name email', model: 'User' })
            .lean();

        res.json({ success: true, data: rooms });
    } catch (err) { next(err); }
};

// @desc  Get creator chat stats
// @route GET /api/v1/chat/creator/stats
// @access Creator
const getCreatorChatStats = async (req, res, next) => {
    try {
        const creatorId = req.user._id;
        const [totalChats, unreadCount, giftEarnings, chatUnlockEarnings] = await Promise.all([
            ChatRoom.countDocuments({ creatorId, isPaid: true }),
            ChatRoom.aggregate([
                { $match: { creatorId, isPaid: true } },
                { $group: { _id: null, total: { $sum: '$unreadByCreator' } } },
            ]),
            Payment.aggregate([
                { $match: { creatorId, type: 'gift', status: 'captured' } },
                { $group: { _id: null, total: { $sum: '$giftAmount' } } },
            ]),
            Payment.aggregate([
                { $match: { creatorId, type: 'chat_unlock', status: 'captured' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                totalChats,
                unreadMessages: unreadCount[0]?.total ?? 0,
                giftEarnings: giftEarnings[0]?.total ?? 0,
                chatUnlockEarnings: chatUnlockEarnings[0]?.total ?? 0,
                totalChatEarnings: (giftEarnings[0]?.total ?? 0) + (chatUnlockEarnings[0]?.total ?? 0),
            },
        });
    } catch (err) { next(err); }
};

// @desc  Get messages for a chat room (paginated)
// @route GET /api/v1/chat/rooms/:chatId/messages
// @access Creator or User in that room
const getRoomMessages = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room) return res.status(404).json({ success: false, message: 'Chat room not found' });

        // Auth check — only the two participants can read
        const isParticipant =
            room.userId.toString() === userId.toString() ||
            room.creatorId.toString() === userId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await ChatMessage.find({ chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Mark messages as seen
        const isCreator = room.creatorId.toString() === userId.toString();
        await ChatMessage.updateMany(
            { chatId, senderId: { $ne: userId }, seen: false },
            { seen: true, seenAt: new Date() }
        );
        // Reset unread counter
        const unreadField = isCreator ? 'unreadByCreator' : 'unreadByUser';
        await ChatRoom.findByIdAndUpdate(chatId, { [unreadField]: 0 });

        res.json({ success: true, data: messages.reverse(), page, limit });
    } catch (err) { next(err); }
};

// @desc  Save a text/image/voice message (REST fallback — primary path is Socket.io)
// @route POST /api/v1/chat/rooms/:chatId/messages
// @access Creator or User in that room
const sendMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { type = 'text', content } = req.body;
        const senderId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });

        const isParticipant =
            room.userId.toString() === senderId.toString() ||
            room.creatorId.toString() === senderId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const message = await ChatMessage.create({ chatId, senderId, type, content });

        // Update room's last message
        const isCreator = room.creatorId.toString() === senderId.toString();
        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: content,
            lastMessageAt: new Date(),
            lastMessageType: type,
            $inc: { [isCreator ? 'unreadByUser' : 'unreadByCreator']: 1 },
        });

        res.status(201).json({ success: true, data: message });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Razorpay order for a gift
// @route POST /api/v1/chat/gift/order
// @access User
const createGiftOrder = async (req, res, next) => {
    try {
        const { chatId, amount } = req.body;
        const userId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });
        if (room.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Only the fan can send gifts' });
        }

        // Enforce gift limits
        const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('minGift maxGift');
        if (profile) {
            if (amount < profile.minGift) return res.status(400).json({ success: false, message: `Minimum gift is ₹${profile.minGift}` });
            if (amount > profile.maxGift) return res.status(400).json({ success: false, message: `Maximum gift is ₹${profile.maxGift}` });
        }

        // Razorpay receipt has a 40-char limit — keep it short
        const receipt = `gf_${String(chatId).slice(-8)}_${Date.now().toString().slice(-8)}`;

        let order;
        try {
            order = await razorpay.orders.create({
                amount: Math.round(amount * 100),
                currency: 'INR',
                receipt,
                notes: { type: 'gift', chatId: String(chatId), userId: String(userId) },
            });
        } catch (rzpErr) {
            const description =
                rzpErr?.error?.description ||
                rzpErr?.error?.reason ||
                rzpErr?.message ||
                'Razorpay order creation failed';
            console.error('[chatController] Gift Razorpay error:', rzpErr?.error || rzpErr);
            return res.status(502).json({ success: false, message: `Payment gateway error: ${description}` });
        }

        await Payment.create({
            userId,
            creatorId: room.creatorId,
            amount,
            giftAmount: amount,
            type: 'gift',
            chatId,
            razorpayOrderId: order.id,
            status: 'created',
        });

        res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (err) { next(err); }
};

// @desc  Verify gift payment and save gift message
// @route POST /api/v1/chat/gift/verify
// @access User
const verifyGift = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, chatId, amount } = req.body;
        const userId = req.user._id;

        // Verify signature
        const expectedSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (expectedSig !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Gift payment verification failed' });
        }

        // Update payment
        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, status: 'captured' },
            { returnDocument: 'after' }
        );

        const room = await ChatRoom.findById(chatId);

        // Save gift message
        const message = await ChatMessage.create({
            chatId,
            senderId: userId,
            type: 'gift',
            content: `Sent a gift of ₹${amount}`,
            giftAmount: amount,
            giftPaymentId: razorpay_payment_id,
        });

        // Update room
        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: `🎁 ₹${amount} gift`,
            lastMessageAt: new Date(),
            lastMessageType: 'gift',
            $inc: { unreadByCreator: 1 },
        });

        // Credit creator earnings
        if (room) {
            await Earnings.findOneAndUpdate(
                { creatorId: room.creatorId },
                { $inc: { totalEarned: amount, pendingAmount: amount } },
                { upsert: true }
            );
        }

        res.json({ success: true, data: message });
    } catch (err) { next(err); }
};

// @desc  Check if user has paid for a chat with a creator
// @route GET /api/v1/chat/status/:creatorId
// @access User (logged in)
const getChatStatus = async (req, res, next) => {
    try {
        const { creatorId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findOne({ creatorId, userId });
        const profile = await CreatorProfile.findOne({ userId: creatorId })
            .select('chatEnabled chatPrice minGift maxGift displayName profileImage username');

        res.json({
            success: true,
            data: {
                isPaid: room?.isPaid ?? false,
                chatId: room?._id ?? null,
                profile,
            },
        });
    } catch (err) { next(err); }
};

module.exports = {
    getChatSettings,
    updateChatSettings,
    createChatUnlockOrder,
    verifyChatUnlock,
    getUserRooms,
    getCreatorRooms,
    getCreatorChatStats,
    getRoomMessages,
    sendMessage,
    createGiftOrder,
    verifyGift,
    getChatStatus,
};
