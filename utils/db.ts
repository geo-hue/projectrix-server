import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl: string = process.env.DB_URL || '';

const options = {
    maxPoolSize: 15, // More conservative pool size
    minPoolSize: 3,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };
  
  const connectDB = async () => {
    try {
        await mongoose.connect(dbUrl, options).then((data: any) => {
            console.log(`Database connected with ${data.connection.host}`);
        });
    } catch (error: any) {
        console.log(error.message);
        setTimeout(connectDB, 5000);
    }
};

export default connectDB;
