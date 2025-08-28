const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0 // Disable mongoose buffering
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`, {
      database: conn.connection.name,
      readyState: conn.connection.readyState
    });

    // Connection event handlers
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    
    // Exit process if we can't connect to database
    setTimeout(() => {
      process.exit(1);
    }, 3000);
  }
};

// Database health check function
const checkDatabaseHealth = async () => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      status: state === 1 ? 'healthy' : 'unhealthy',
      state: states[state],
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Database initialization function for first-time setup
const initializeDatabase = async () => {
  try {
    // Create indexes for better performance
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Index creation for common queries
    const indexes = {
      users: [
        { email: 1 },
        { role: 1 },
        { createdAt: -1 }
      ],
      students: [
        { studentId: 1 },
        { parentId: 1 },
        { enrollmentStatus: 1 },
        { className: 1 }
      ],
      emails: [
        { receivedAt: -1 },
        { category: 1 },
        { priority: 1 },
        { processed: 1 }
      ],
      payments: [
        { studentId: 1 },
        { dueDate: 1 },
        { status: 1 },
        { createdAt: -1 }
      ],
      waitlists: [
        { position: 1 },
        { dateAdded: 1 },
        { status: 1 }
      ],
      expenses: [
        { date: -1 },
        { category: 1 },
        { taxYear: 1 }
      ]
    };

    for (const [collection, indexFields] of Object.entries(indexes)) {
      if (collectionNames.includes(collection)) {
        for (const indexField of indexFields) {
          try {
            await mongoose.connection.db.collection(collection).createIndex(indexField);
            logger.info(`Created index for ${collection}:`, indexField);
          } catch (indexError) {
            // Index might already exist, continue
            if (!indexError.message.includes('already exists')) {
              logger.warn(`Failed to create index for ${collection}:`, indexError.message);
            }
          }
        }
      }
    }

    logger.info('✅ Database initialization completed');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
  }
};

// Cleanup old data function
const cleanupOldData = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Clean up processed emails older than 30 days
    const emailResult = await mongoose.connection.db.collection('emails')
      .deleteMany({ 
        processed: true, 
        processedAt: { $lt: thirtyDaysAgo } 
      });

    // Clean up expired sessions
    const sessionResult = await mongoose.connection.db.collection('sessions')
      .deleteMany({ 
        expires: { $lt: new Date() } 
      });

    logger.info(`Cleanup completed: ${emailResult.deletedCount} emails, ${sessionResult.deletedCount} sessions`);
  } catch (error) {
    logger.error('Database cleanup failed:', error);
  }
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  initializeDatabase,
  cleanupOldData
};