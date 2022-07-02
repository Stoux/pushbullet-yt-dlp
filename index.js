import 'dotenv/config';
import {getDeviceIdentifier} from "./device.js";
import {getLatestPushFor} from "./pushes.js";
import {connect} from "./socket.js";
import {Bot} from "./Bot.js";

if (!process.env.PUSHBULLET_TOKEN || !process.env.PUSHBULLET_DEVICE_NAME) {
    console.error('Missing pushbullet token or device name');
    process.exit(1);
}

// Find and setup the device
const deviceId = await getDeviceIdentifier();
const bot = new Bot(deviceId);

// Setup the websocket for listening to changes
connect(async () => {
    console.log('On new push, fetching!');
    const push = await getLatestPushFor(deviceId)
    if (push === undefined) {
        console.log('=> Not for us.');
        return;
    }

    // Last push
    bot.onPushReceived(push);
});