const { sequelize } = require('./dbObjects.js');

async function syncDatabase() {
    try {
        await sequelize.sync({ alter: false });
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Error syncing database:', error);
    } finally {
        await sequelize.close();
    }
}

syncDatabase();
