# Pushbullet + Youtube-DL(P)

A little bot thingy that you can send URLs to which it will download. Then it will prompt you for a file name and move
the resulting file to a folder of your choosing.

## Setup

- Run `npm install`
- Copy `.env.sample` to `.env`, fill in the details.
- Run `node index.js`

Now there should be a device with your given .env name in Pushbullet. Send it a link to download.

## Disclaimer

This is just a quick and dirty little script. It probably has some edge cases that might break it, there is no clean-up
so if something fails your downloads folder might have left-overs and I don't do any websocket reconnection.

No support is provided, use as is. MIT licensed, feel free to do whatever with it.