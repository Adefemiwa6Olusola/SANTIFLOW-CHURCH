import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://olusola:timmy33-335@cluster0.zpxwgjy.mongodb.net/sanctiflow?retryWrites=true&w=majority';

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is missing.');
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB Cloud');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Define Schemas
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  churchName: { type: String, default: '' },
  role: { type: String, default: 'operator' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const historySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, default: 'AI' },
  // Mixed type to hold arbitrary verse data
  verseData: { type: mongoose.Schema.Types.Mixed }
});

const queueSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  // Mixed type to hold arbitrary verse data
  verseData: { type: mongoose.Schema.Types.Mixed }
});

const resetTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Number, required: true }
});

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Create Models
const User = mongoose.model('User', userSchema);
const History = mongoose.model('History', historySchema);
const Queue = mongoose.model('Queue', queueSchema);
const ResetToken = mongoose.model('ResetToken', resetTokenSchema);
const Otp = mongoose.model('Otp', otpSchema);

export const db = {
  // Users API
  async getUsers() {
    return await User.find({}).lean();
  },
  
  async findUserByEmail(email) {
    const normalized = email.toLowerCase().trim();
    return await User.findOne({ email: normalized }).lean();
  },
  
  async findUserById(id) {
    return await User.findOne({ id }).lean();
  },
  
  async createUser(user) {
    const newUser = new User({
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      email: user.email.toLowerCase().trim(),
      password: user.password,
      name: user.name,
      churchName: user.churchName || '',
      role: user.role || 'operator'
    });
    await newUser.save();
    return newUser.toObject();
  },

  async updateUserPassword(userId, hashedPassword) {
    const result = await User.updateOne(
      { id: userId }, 
      { password: hashedPassword, updatedAt: new Date() }
    );
    return result.modifiedCount > 0;
  },

  // Password Reset Tokens
  async createResetToken(tokenData) {
    await ResetToken.deleteMany({ userId: tokenData.userId });
    const newToken = new ResetToken(tokenData);
    await newToken.save();
    return newToken.toObject();
  },

  async findResetToken(token) {
    return await ResetToken.findOne({ token }).lean();
  },

  async deleteResetToken(token) {
    await ResetToken.deleteOne({ token });
  },

  async cleanExpiredTokens() {
    const now = Date.now();
    await ResetToken.deleteMany({ expiresAt: { $lt: now } });
  },

  // OTP verification
  async createOtp(otpData) {
    await Otp.deleteMany({ email: otpData.email });
    const newOtp = new Otp(otpData);
    await newOtp.save();
    return newOtp.toObject();
  },

  async findOtpByEmail(email) {
    const normalized = email.toLowerCase().trim();
    return await Otp.findOne({ email: normalized }).lean();
  },

  async deleteOtp(email) {
    const normalized = email.toLowerCase().trim();
    await Otp.deleteOne({ email: normalized });
  },

  async updateOtpAttempts(email, attempts) {
    const normalized = email.toLowerCase().trim();
    const result = await Otp.updateOne({ email: normalized }, { attempts });
    return result.modifiedCount > 0;
  },

  // History API
  async getHistory() {
    return await History.find({}).sort({ timestamp: -1 }).limit(100).lean();
  },
  
  async addToHistory(verseData, type = 'AI') {
    const entry = new History({
      id: Date.now().toString(),
      type,
      verseData
    });
    await entry.save();
    // Keep only last 100
    const count = await History.countDocuments();
    if (count > 100) {
      const oldest = await History.find().sort({ timestamp: 1 }).limit(count - 100);
      const oldestIds = oldest.map(doc => doc._id);
      await History.deleteMany({ _id: { $in: oldestIds } });
    }
    return entry.toObject();
  },
  
  async clearHistory() {
    await History.deleteMany({});
  },

  // Queue API
  async getQueue() {
    return await Queue.find({}).lean();
  },
  
  async addToQueue(verseData) {
    const entry = new Queue({
      id: Date.now().toString(),
      verseData
    });
    await entry.save();
    return entry.toObject();
  },
  
  async updateQueue(newQueue) {
    await Queue.deleteMany({});
    if (newQueue && newQueue.length > 0) {
      const docs = newQueue.map(item => ({
        id: item.id || Date.now().toString() + Math.random().toString(),
        verseData: item.verseData || item
      }));
      await Queue.insertMany(docs);
    }
    return newQueue;
  },
  
  async removeFromQueue(id) {
    await Queue.deleteOne({ id: id.toString() });
  },
  
  async clearQueue() {
    await Queue.deleteMany({});
  }
};

export default db;
