// backend/database/factories/orders_factory.js

const faker = require('faker');

const createOrder = () => {
    const quantity = faker.datatype.number({ min: 1, max: 10 });
    const pricePerUnit = faker.datatype.float({ min: 10, max: 500, precision: 0.01 });
    const total_price = parseFloat((quantity * pricePerUnit).toFixed(2));
    const statuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

    return {
        product_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your products
        user_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your users
        quantity,
        total_price,
        status: faker.random.arrayElement(statuses),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createOrder };
