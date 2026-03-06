const mongoose = require('mongoose');

const connectDB = async () => {
    try {

        // Protect against query injection

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            autoIndex: true
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {

        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);

    }
};

module.exports = { connectDB };