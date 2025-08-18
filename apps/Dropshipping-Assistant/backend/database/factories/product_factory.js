// backend/database/factories/product_factory.js

const faker = require('faker');

const createProduct = () => {
    return {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price()),
        currency: 'USD',
        url: faker.internet.url(),
        image_url: faker.image.imageUrl(),
        category: faker.commerce.department(),
        shipping_weight: parseFloat(faker.commerce.price(1, 10, 2)), // Weight between 1kg and 10kg
        shipping_dimensions: `${faker.datatype.number({ min: 5, max: 50 })}x${faker.datatype.number({ min: 5, max: 50 })}x${faker.datatype.number({ min: 5, max: 50 })}`, // e.g., 10x5x3
        sales_rank: faker.datatype.number({ min: 1, max: 1000 }),
        supplier_name: faker.company.companyName(),
        supplier_rating: parseFloat(faker.datatype.float({ min: 1, max: 5, precision: 0.1 })),
        supplier_contact_email: faker.internet.email(),
        supplier_contact_phone: faker.phone.phoneNumber(),
        supplier_website: faker.internet.url(),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createProduct };
