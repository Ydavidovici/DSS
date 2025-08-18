// backend/database/factories/reviews_factory.js

const faker = require('faker');

const createReview = () => {
    return {
        product_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your products
        user_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your users
        rating: faker.datatype.number({ min: 1, max: 5 }),
        comment: faker.lorem.sentences(),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createReview };
