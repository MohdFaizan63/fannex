const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const CreatorProfile = require('../models/CreatorProfile');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Earnings = require('../models/Earnings');
const paymentService = require('../services/paymentService');
const Subscription = require('../models/Subscription');

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SETTINGS (Creator only)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Get creator's own chat settings
// @route GET /api/v1/chat/creator/settings
// @access Creator
const getChatSettings = async (req, res, next) => {
    try {
        const profile = await CreatorProfile.findOne({ userId: req.user._id }).select(
            'chatEnabled chatPrice messagePrice minGift maxGift'
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
        const { chatEnabled, chatPrice, messagePrice, minGift, maxGift } = req.body;

        const profile = await CreatorProfile.findOne({ userId: req.user._id });
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found' });

        if (chatEnabled !== undefined) profile.chatEnabled = chatEnabled;
        // BUG-8 FIX: Guard against negative / invalid values with Math.max(0, ...)
        if (chatPrice !== undefined) profile.chatPrice = Math.max(0, Number(chatPrice) || 0);
        if (messagePrice !== undefined) profile.messagePrice = Math.max(0, Number(messagePrice) || 0);
        if (minGift !== undefined) profile.minGift = Math.max(1, Number(minGift) || 1);
        if (maxGift !== undefined) profile.maxGift = Math.max(profile.minGift, Number(maxGift) || 10000);

        await profile.save({ validateModifiedOnly: true });

        res.json({
            success: true,
            data: {
                chatEnabled: profile.chatEnabled,
                chatPrice: profile.chatPrice,
                messagePrice: profile.messagePrice,
                minGift: profile.minGift,
                maxGift: profile.maxGift,
            },
        });
    } catch (err) {
        console.error('updateChatSettings error:', err.message);
        next(err);
    }
};

// @desc  Get chat info for a room: messagePrice + fan wallet balance
// @route GET /api/v1/chat/rooms/:chatId/info
// @access User or Creator in that room
const getChatInfo = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room) return res.status(404).json({ success: false, message: 'Chat room not found' });

        const isParticipant =
            room.userId.toString() === userId.toString() ||
            room.creatorId.toString() === userId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const [profile, fan] = await Promise.all([
            CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice displayName chatEnabled'),
            User.findById(room.userId).select('walletBalance'),
        ]);

        res.json({
            success: true,
            data: {
                messagePrice: profile?.messagePrice ?? 0,
                walletBalance: fan?.walletBalance ?? 0,
                creatorName: profile?.displayName ?? '',
                chatEnabled: profile?.chatEnabled ?? true,
            },
        });
    } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// CHAT UNLOCK (User)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order to unlock a chat room
// @route POST /api/v1/chat/unlock
// @access User (logged in)
const createChatUnlockOrder = async (req, res, next) => {
    try {
        const { creatorId } = req.body;
        const user = req.user;

        // Check existing room
        const existing = await ChatRoom.findOne({ creatorId, userId: user._id });
        if (existing?.isPaid) {
            return res.json({ success: true, alreadyUnlocked: true, chatId: existing._id });
        }

        // Get creator's chat price
        const profile = await CreatorProfile.findOne({ userId: creatorId }).select('chatPrice chatEnabled displayName');
        if (!profile) return res.status(400).json({ success: false, message: 'Creator not found' });
        if (!profile.chatEnabled) {
            return res.status(400).json({ success: false, message: 'Chat not available — creator has disabled chat' });
        }

        const chatPrice = profile.chatPrice || 299;
        const orderId = `cu_${String(user._id).slice(-8)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: chatPrice,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                creatorId: creatorId.toString(),
                type: 'chat_unlock',
            },
        });

        // Save payment record
        await Payment.create({
            userId: user._id,
            creatorId,
            amount: chatPrice,
            type: 'chat_unlock',
            cfOrderId: order.orderId,
            status: 'created',
        });

        res.json({ success: true, order, chatPrice: profile.chatPrice, creatorName: profile.displayName });
    } catch (err) { next(err); }
};

// @desc  Verify Cashfree payment and unlock chat room
// @route POST /api/v1/chat/unlock/verify
// @access User
const verifyChatUnlock = async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const userId = req.user._id;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Payment not completed' });
        }

        // Extract creatorId from order_tags
        const tags = orderData.order_tags || {};
        const creatorId = req.body.creatorId || tags.creatorId;
        if (!creatorId) {
            return res.status(400).json({ success: false, message: 'Could not determine creator from order' });
        }

        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch (e) {
            console.warn('[verifyChatUnlock] Could not fetch payment details:', e.message);
        }

        // ── BULLETPROOF IDEMPOTENCY: claim side effects exactly once ────────────
        // Step 1: ensure doc exists with sideEffectsDone: false
        await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            { $setOnInsert: { sideEffectsDone: false, status: 'created' } },
            { upsert: true }
        );

        // Step 2: atomically claim the lock
        const claimed = await Payment.findOneAndUpdate(
            { cfOrderId: orderId, sideEffectsDone: false },
            { $set: { status: 'captured', cfPaymentId: cfPaymentId || null, sideEffectsDone: true } },
            { new: false }
        );

        // Create or unlock chat room (always idempotent — upsert)
        const room = await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, chatPaymentId: cfPaymentId, unlockedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );

        // Link chatId back to Payment doc
        await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            { $set: { chatId: room._id } },
            { upsert: false }
        );

        if (claimed) {
            // Only the FIRST caller credits earnings — 80/20 GST split
            const grossAmount = Number(claimed.amount || orderData.order_amount || 0);
            const base = Math.round(grossAmount / 1.18 * 100) / 100;
            const creatorEarning = Math.round(base * 0.8 * 100) / 100;
            const platformFee = Math.round(base * 0.2 * 100) / 100;
            const gstAmount = Math.round((grossAmount - base) * 100) / 100;

            // Write correct amounts back to Payment doc
            await Payment.findOneAndUpdate(
                { cfOrderId: orderId },
                { $set: { baseAmount: base, gstAmount, platformFee, creatorEarning } },
                { upsert: false }
            );

            await Earnings.findOneAndUpdate(
                { creatorId },
                { $inc: { totalEarned: creatorEarning, pendingAmount: creatorEarning } },
                { upsert: true }
            );
            console.log(`[verifyChatUnlock] ✅ Earnings credited creatorId=${creatorId} amount=₹${creatorEarning}`);
        } else {
            console.log(`[verifyChatUnlock] ℹ️ Already processed, skipping orderId=${orderId}`);
        }

        res.json({ success: true, chatId: room._id });
    } catch (err) {
        console.error('[verifyChatUnlock] Error:', err.message);
        next(err);
    }
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

        const isCreator = room.creatorId.toString() === senderId.toString();

        // ── Wallet deduction for fan messages ─────────────────────────────────
        if (!isCreator) {
            // BUG-7 FIX: Use messagePrice (per-message cost), not chatPrice (unlock cost)
            const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice');
            const msgCost = profile?.messagePrice ?? 0;

            if (msgCost > 0) {
                const fan = await User.findById(senderId).select('walletBalance');
                if (!fan || (fan.walletBalance ?? 0) < msgCost) {
                    return res.status(402).json({
                        success: false,
                        message: 'Insufficient wallet balance. Please top up to continue chatting.',
                        required: msgCost,
                        walletBalance: fan?.walletBalance ?? 0,
                    });
                }
                // Deduct from wallet and credit creator
                await User.findByIdAndUpdate(senderId, { $inc: { walletBalance: -msgCost } });
                await Earnings.findOneAndUpdate(
                    { creatorId: room.creatorId },
                    { $inc: { totalEarned: msgCost, pendingAmount: msgCost } },
                    { upsert: true }
                );
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        const message = await ChatMessage.create({ chatId, senderId, type, content });

        // Update room's last message
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

// @desc  Create Cashfree order for a gift
// @route POST /api/v1/chat/gift/order
// @access User
const createGiftOrder = async (req, res, next) => {
    try {
        const { chatId, amount } = req.body;
        const user = req.user;

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });
        if (room.userId.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the fan can send gifts' });
        }

        const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('minGift maxGift');
        // BUG-6 FIX: minimum ₹1 (payment gateways reject sub-₹1 INR amounts)
        // BUG-8 FIX: default maxGift to ₹10,000 when creator hasn't configured it
        const minGift = profile?.minGift ?? 1;
        const maxGift = profile?.maxGift ?? 10000;
        if (amount < minGift) return res.status(400).json({ success: false, message: `Minimum gift is ₹${minGift}` });
        if (amount > maxGift) return res.status(400).json({ success: false, message: `Maximum gift is ₹${maxGift}` });

        const orderId = `gf_${String(chatId).slice(-8)}_${Date.now()}`;
        const order = await paymentService.createOrder({
            amount,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: { userId: user._id.toString(), creatorId: room.creatorId.toString(), type: 'gift', chatId: String(chatId) },
        });

        await Payment.create({
            userId: user._id,
            creatorId: room.creatorId,
            amount,
            giftAmount: amount,
            type: 'gift',
            chatId,
            cfOrderId: order.orderId,
            status: 'created',
        });

        res.json({ success: true, order });
    } catch (err) { next(err); }
};

// @desc  Verify gift payment and save gift message
// @route POST /api/v1/chat/gift/verify
// @access User
const verifyGift = async (req, res, next) => {
    try {
        const { orderId, chatId } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Gift payment not completed' });
        }

        // Use verified amount from Cashfree — never trust client-supplied amount
        const amount = Number(orderData.order_amount);

        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch { /* cfPaymentId is optional */ }

        // ── Idempotency: check if ChatMessage already exists ─────────────────────
        const existingMsg = await ChatMessage.findOne({ chatId, content: { $regex: orderId } })
            || (cfPaymentId ? await ChatMessage.findOne({ chatId, type: 'gift', giftPaymentId: cfPaymentId }) : null)
            || await ChatMessage.findOne({ chatId, type: 'gift', giftAmount: amount, senderId: userId });

        if (existingMsg) {
            return res.json({ success: true, data: existingMsg });
        }

        // ── BULLETPROOF IDEMPOTENCY: claim earnings exactly once ─────────────────
        // Step 1: calculate correct split
        const base = Math.round(amount / 1.18 * 100) / 100;
        const creatorEarning = Math.round(base * 0.8 * 100) / 100;
        const platformFee    = Math.round(base * 0.2 * 100) / 100;
        const gstAmount      = Math.round((amount - base) * 100) / 100;

        // Step 2: atomically claim — only first caller sets sideEffectsDone false→true
        const claimed = await Payment.findOneAndUpdate(
            { cfOrderId: orderId, sideEffectsDone: false },
            {
                $set: {
                    status: 'captured',
                    cfPaymentId: cfPaymentId || null,
                    sideEffectsDone: true,
                    giftAmount: amount,
                    baseAmount: base,
                    gstAmount,
                    platformFee,
                    creatorEarning,         // ← shows in Earning History
                    _earningsCredited: true,
                },
            },
            { new: false }
        );

        // Step 3: If doc doesn't exist (no Payment created yet), insert it
        if (!claimed) {
            await Payment.findOneAndUpdate(
                { cfOrderId: orderId },
                {
                    $setOnInsert: {
                        userId,
                        amount,
                        giftAmount: amount,
                        type: 'gift',
                        chatId,
                        cfOrderId: orderId,
                        status: 'captured',
                        cfPaymentId: cfPaymentId || null,
                        sideEffectsDone: true,
                        _earningsCredited: false,   // will be claimed below
                    },
                },
                { upsert: true }
            );

            // CRITICAL FIX: ALWAYS write the correct amounts into the doc.
            // If webhook ran first it set sideEffectsDone=true but LEFT creatorEarning=0.
            // This $set ensures the doc always has correct fields for Earning History display.
            await Payment.findOneAndUpdate(
                { cfOrderId: orderId },
                {
                    $set: {
                        status: 'captured',
                        cfPaymentId: cfPaymentId || null,
                        giftAmount: amount,
                        baseAmount: base,
                        gstAmount,
                        platformFee,
                        creatorEarning,
                    },
                },
                { upsert: false }
            );
        }

        // Step 4: Credit Earnings exactly once — guarded by _earningsCredited flag
        const earnClaim = await Payment.findOneAndUpdate(
            { cfOrderId: orderId, _earningsCredited: { $ne: true } },
            { $set: { _earningsCredited: true } },
            { new: false }
        );
        const room = await ChatRoom.findById(chatId);
        if (!room) return res.status(404).json({ success: false, message: 'Chat room not found' });

        if (earnClaim) {
            await Earnings.findOneAndUpdate(
                { creatorId: room.creatorId },
                { $inc: { totalEarned: creatorEarning, pendingAmount: creatorEarning } },
                { upsert: true }
            );
            console.log(`[verifyGift] ✅ Gift earnings credited creatorId=${room.creatorId} amount=₹${creatorEarning}`);
        } else {
            console.log(`[verifyGift] ℹ️ Gift earnings already credited, skipping orderId=${orderId}`);
        }

        // Save gift message
        const message = await ChatMessage.create({
            chatId,
            senderId: userId,
            type: 'gift',
            content: `Sent a gift of ₹${amount} [${orderId}]`,
            giftAmount: amount,
            giftPaymentId: cfPaymentId,
        });

        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: `🎁 ₹${amount} gift`,
            lastMessageAt: new Date(),
            lastMessageType: 'gift',
            $inc: { unreadByCreator: 1 },
        });

        // Broadcast gift message to anyone in the chat room
        const io = req.app.get('io');
        if (io) io.to(String(chatId)).emit('new_message', message.toObject ? message.toObject() : message);

        res.json({ success: true, data: message });
    } catch (err) {
        console.error('[verifyGift] Error:', err.message);
        next(err);
    }
};





// @desc  Check if user has paid for a chat with a creator
//        Subscribers automatically get chat access for free.
// @route GET /api/v1/chat/status/:creatorId
// @access User (logged in)
const getChatStatus = async (req, res, next) => {
    try {
        const { creatorId } = req.params;
        const userId = req.user._id;

        // Check if user has an active subscription to this creator
        const activeSubscription = await Subscription.findOne({
            userId,
            creatorId,
            status: 'active',
            expiresAt: { $gt: new Date() },
        });

        let room = await ChatRoom.findOne({ creatorId, userId });
        const profile = await CreatorProfile.findOne({ userId: creatorId })
            .select('chatEnabled chatPrice minGift maxGift displayName profileImage username');

        // If subscribed but no chat room yet, auto-create one
        if (activeSubscription && !room) {
            room = await ChatRoom.findOneAndUpdate(
                { creatorId, userId },
                { isPaid: true, unlockedAt: new Date() },
                { upsert: true, returnDocument: 'after' }
            );
        }

        // If subscribed but room exists and is not paid, upgrade it
        if (activeSubscription && room && !room.isPaid) {
            room = await ChatRoom.findByIdAndUpdate(
                room._id,
                { isPaid: true, unlockedAt: new Date() },
                { returnDocument: 'after' }
            );
        }

        const isPaid = activeSubscription ? true : (room?.isPaid ?? false);

        res.json({
            success: true,
            data: {
                isPaid,
                chatId: room?._id ?? null,
                isSubscriber: !!activeSubscription,
                profile,
            },
        });
    } catch (err) { next(err); }
};

// @desc  Upload an image and send it as a chat message
// @route POST /api/v1/chat/rooms/:chatId/upload-image
// @access Creator or User in that room
const sendImageMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const senderId = req.user._id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });

        const isParticipant =
            room.userId.toString() === senderId.toString() ||
            room.creatorId.toString() === senderId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const isCreator = room.creatorId.toString() === senderId.toString();

        // ── Wallet deduction for fan image messages (same as text messages) ─────
        if (!isCreator) {
            const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice');
            const msgCost = profile?.messagePrice ?? 0;
            if (msgCost > 0) {
                const fan = await User.findById(senderId).select('walletBalance');
                if (!fan || (fan.walletBalance ?? 0) < msgCost) {
                    return res.status(402).json({
                        success: false,
                        message: 'Insufficient wallet balance. Please top up to continue chatting.',
                        required: msgCost,
                        walletBalance: fan?.walletBalance ?? 0,
                    });
                }
                await User.findByIdAndUpdate(senderId, { $inc: { walletBalance: -msgCost } });
                await Earnings.findOneAndUpdate(
                    { creatorId: room.creatorId },
                    { $inc: { totalEarned: msgCost, pendingAmount: msgCost } },
                    { upsert: true }
                );
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        const imageUrl = req.file.path || req.file.secure_url || req.file.location || '';

        const message = await ChatMessage.create({
            chatId,
            senderId,
            type: 'image',
            content: imageUrl,
        });

        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: '📷 Image',
            lastMessageAt: new Date(),
            lastMessageType: 'image',
            $inc: { [isCreator ? 'unreadByUser' : 'unreadByCreator']: 1 },
        });

        const io = req.app.get('io');
        if (io) {
            io.to(String(chatId)).emit('new_message', message.toObject ? message.toObject() : message);
        }

        res.status(201).json({ success: true, data: message });
    } catch (err) { next(err); }
};


module.exports = {
    getChatSettings,
    updateChatSettings,
    getChatInfo,
    createChatUnlockOrder,
    verifyChatUnlock,
    getUserRooms,
    getCreatorRooms,
    getCreatorChatStats,
    getRoomMessages,
    sendMessage,
    sendImageMessage,
    createGiftOrder,
    verifyGift,
    getChatStatus,
};

