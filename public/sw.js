// Service Worker for Push Notifications
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
            console.log('Parsed notification data:', data);
        } catch (e) {
            console.error('Failed to parse push data:', e);
            data = {
                title: 'New Notification',
                body: event.data.text(),
            };
        }
    } else {
        console.warn('Push event received without data');
        data = {
            title: 'SmartTasker Notification',
            body: 'You have a new notification',
        };
    }

    const title = data.title || 'SmartTasker Notification';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/manifest-icon-192.maskable.png',
        badge: '/manifest-icon-192.maskable.png',
        vibrate: [200, 100, 200],
        data: data,
        tag: data.tag || 'task-reminder',
        requireInteraction: true, // Changed to true so notification stays until user interacts
        silent: false, // Ensure notification makes a sound
    };

    console.log('Showing notification with title:', title);
    console.log('Notification options:', options);

    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => {
                console.log('Notification displayed successfully');
            })
            .catch((error) => {
                console.error('Failed to show notification:', error);
            })
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    // Open the app when notification is clicked
    event.waitUntil(
        clients.openWindow('/')
    );
});
