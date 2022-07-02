import axios from "axios";

let lastCheck = new Date().getTime() / 1000 - 3600; // TODO: Remove debugging minutes

export async function getLatestPushFor(deviceId) {
    const pushes = (await axios.get('https://api.pushbullet.com/v2/pushes', {
        headers: {
            'Access-Token': process.env.PUSHBULLET_TOKEN,
        },
        params: {
            modified_after: lastCheck,
            limit: 1,
        }
    })).data.pushes;
    lastCheck = new Date().getTime() / 1000;


    const filtered = pushes.filter(push => push.target_device_iden === deviceId)
        .filter(push => !push.body || typeof push.body !== 'string' || !push.body.startsWith('BOT: '));

    return filtered.length > 0 ? filtered[0] : undefined;
}
