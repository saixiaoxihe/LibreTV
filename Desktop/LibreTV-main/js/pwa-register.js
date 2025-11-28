// PWA 注册
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}
