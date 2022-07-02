import axios from "axios";

export async function getDeviceIdentifier() {
    // Fetch the current devices
    const devices = (await axios.get('https://api.pushbullet.com/v2/devices', {
        headers: {
            'Access-Token': process.env.PUSHBULLET_TOKEN,
        }
    })).data.devices;

    // Check if the device with our nickname already exists
    for (const device of devices) {
        if (device.nickname === process.env.PUSHBULLET_DEVICE_NAME) {
            // Found the device
            console.log('Found our device', device.iden, `(${device.nickname})`);
            return device.iden;
        }
    }

    // Create the device
    console.log('Device not found, creating our own.');

    const createdDevice = (await axios.post('https://api.pushbullet.com/v2/devices', {
        nickname: process.env.PUSHBULLET_DEVICE_NAME,
        icon: 'system',
        has_sms: false,
    }, {
        headers: {
            'Access-Token': process.env.PUSHBULLET_TOKEN,
        }
    })).data;

    console.log('Created a new device', createdDevice);

    return createdDevice.iden;
}