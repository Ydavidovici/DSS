// backend/database/factories/notifications_factory.js

const faker = require('faker');

const createNotification = () => {
    const notificationTypes = ['Email', 'SMS', 'Push Notification'];
    const statuses = ['Pending', 'Sent', 'Failed'];

    return {
        user_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your users
        alert_id: faker.datatype.number({ min: 1, max: 100 }), // Adjust based on your alerts
        notification_type: faker.random.arrayElement(notificationTypes),
        message: faker.lorem.sentences(),
        sent_at: faker.datatype.boolean() ? faker.date.recent() : null,
        status: faker.random.arrayElement(statuses),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createNotification };
