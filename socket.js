import websocket from "websocket";

/**
 * @param {function} onNewPush
 */
export function connect(onNewPush) {
    const client = new websocket.client();

    client.on('connectFailed', error => {
        console.error(error);
        console.error('Failed to connect to websocket. Shutting down!');
        // TODO: Sentry error
        process.exit(1);
    })

    client.on('connect', connection => {
        console.log('Connected to PushBullet websocket');

        connection.on('message', message => {
            const payload = JSON.parse(message.utf8Data);
            if (payload.type === 'tickle' && payload.subtype === 'push') {
                onNewPush();
            }
        });
    });

    client.connect('wss://stream.pushbullet.com/websocket/' + process.env.PUSHBULLET_TOKEN);
}
