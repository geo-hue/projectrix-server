"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    const start = Date.now();
    console.log('\n' + '─'.repeat(80).gray);
    console.log(`📥 ${req.method.green} ${req.url.blue}`);
    console.log('Headers:'.yellow, JSON.stringify(req.headers, null, 2));
    console.log('Body:'.yellow, JSON.stringify(req.body, null, 2));
    // Capture the original send function
    const oldSend = res.send;
    // Override the send function
    res.send = function (data) {
        const duration = Date.now() - start;
        console.log(`\n📤 Response (${duration}ms):`.green);
        console.log('Status:'.yellow, res.statusCode);
        try {
            console.log('Body:'.yellow, JSON.stringify(JSON.parse(data.toString()), null, 2));
        }
        catch {
            console.log('Body:'.yellow, data);
        }
        console.log('─'.repeat(80).gray + '\n');
        // Call the original send function
        return oldSend.apply(res, arguments);
    };
    next();
};
exports.requestLogger = requestLogger;
