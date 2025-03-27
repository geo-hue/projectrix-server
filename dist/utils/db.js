"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbUrl = process.env.DB_URL || '';
const options = {
    maxPoolSize: 15, // More conservative pool size
    minPoolSize: 3,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
};
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(dbUrl, options).then((data) => {
            console.log(`Database connected with ${data.connection.host}`);
        });
    }
    catch (error) {
        console.log(error.message);
        setTimeout(connectDB, 5000);
    }
};
exports.default = connectDB;
