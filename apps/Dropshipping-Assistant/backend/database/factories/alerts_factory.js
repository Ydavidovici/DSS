// backend/database/factories/alerts_factory.js

const faker = require('faker');

const createAlert = () => {
    const alertTypes = ['High Competition', 'Low Demand', 'Stock Low', 'Price Drop'];
    return {
        product_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your products
        alert_type: faker.random.arrayElement(alertTypes),
        message: faker.lorem.sentence(),
        is_active: faker.datatype.boolean(),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createAlert };
