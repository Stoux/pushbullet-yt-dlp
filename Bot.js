import axios from "axios";
import http from 'https';
import { spawn } from 'node:child_process';
import { rmSync, copyFileSync, existsSync, createWriteStream, unlinkSync } from 'fs';

const STATE_WAITING_FOR_URL = 'url';
const STATE_IN_PROGRESS = 'in_progress';
const STATE_WAITING_FOR_NAME = 'name';



export class Bot {


    constructor(sourceDeviceId) {
        this.sourceDeviceId = sourceDeviceId;
        this.state = STATE_WAITING_FOR_URL
        this.lastSourceDevice = undefined;
        this.currentUrl = undefined;
        this.downloadedFile = [ 'name', 'extension' ];
        this.deletePushes = [];
    }

    onPushReceived(push) {
        this.lastSourceDevice = push.source_device_iden;

        if (this.state === STATE_WAITING_FOR_URL) {
            // Download a file that's uploaded through Pushbullet
            if (push.file_url) {
                this.currentUrl = push.file_url;
                console.log('Downloading PushBullet File:', push.file_name);
                this.state = STATE_IN_PROGRESS;
                this.storePushForDeletion(push.iden);
                this.downloadFile(push.file_name)
                return;
            }

            if (!push.url) {
                console.error('Received push without URL while waiting for URL.');
                this.sendReply('Currently waiting for an URL to download, no URL given.');
                return;
            }

            // Download the URL
            const url = this.currentUrl = push.url;
            console.log('Downloading URL: ' + url);
            this.state = STATE_IN_PROGRESS;
            this.storePushForDeletion(push.iden);
            this.downloadUrl();
        } else if (this.state === STATE_WAITING_FOR_NAME) {
            const finalName = this.getValidName(push.body);
            if (!finalName) {
                console.error('Invalid name given:', push.body);
                this.sendReply('Seems like an invalid file name. Try something else or type CANCEL.');
                return;
            }

            if (finalName.toUpperCase() === 'CANCEL') {
                console.log('Cancel received. Cleaning up & resetting');
                const downloadedPath = process.env.DOWNLOAD_FOLDER + '/' + this.getDownloadedFile();
                console.log('Deleting', downloadedPath);
                rmSync(downloadedPath);
                console.log('Resetting state');
            } else {
                this.storePushForDeletion(push.iden);

                console.log('New file name received:', finalName, '| Checking for conflict');
                const downloadedPath = process.env.DOWNLOAD_FOLDER + '/' + this.getDownloadedFile();
                const newFileName = finalName + '.' + this.downloadedFile[1];
                const newFilePath = process.env.STORAGE_FOLDER + '/' + newFileName;

                if (existsSync(newFilePath)) {
                    console.error('Conflict, already exists:', newFilePath);
                    this.sendReply(`Error: File ${newFileName} already exists in target folder. Try another name or type CANCEL.`, true);
                    return;
                }

                console.log('Copying file from', downloadedPath, 'to', newFilePath);
                copyFileSync(downloadedPath, newFilePath);
                console.log('Removing downloaded file');
                rmSync(downloadedPath);

                // Notify the user
                if (process.env.BASE_WEB_FOLDER_URL) {
                    this.sendReply('File downloaded. Available at: ' + `${process.env.BASE_WEB_FOLDER_URL}/${newFileName}`);
                } else {
                    this.sendReply('File downloaded: ' + newFilePath);
                }

                this.cleanPushes();

                console.log('Done! Cleaning up.');
            }

            // Clean up state & reset.
            this.reset();
        } else if (this.state === STATE_IN_PROGRESS) {
            console.error('Currently in progress, unable to handle request');
            this.sendReply('An action is currently in progress. Please wait.', true);
        }
    }

    downloadUrl() {
        // yt-dlp -f best --no-playlist --no-progress --console-title https://youtu.be/tnCX_gIDSrA
        const download = spawn(process.env.YT_DLP_PATH, [ '-f', 'best', '--no-playlist', '--no-progress', this.currentUrl ], {
            cwd: process.env.DOWNLOAD_FOLDER,
        })

        let fileName = undefined;

        download.stdout.on('data', chunk => {
            let line = chunk.toString().trim();
            console.log('[DOWNLOAD DEBUG]', line);
            const match = /\[download] Destination: (.+)\.(\w{1,5})$/.exec(line);
            if (match) {
                fileName = [ match[1], match[2] ];
            }
        });

        download.on('exit', (code, signal) => {
            console.log('Finished download', code, signal);

            if (code === 0 && fileName) {
                this.downloadedFile = fileName;
                this.state = STATE_WAITING_FOR_NAME;
                console.log(`Downloaded file: ${this.getDownloadedFile()}`);
                this.sendReply(`Downloaded file '${this.downloadedFile[0]}' (${this.downloadedFile[1]}). Please send new file name (without extension) or type CANCEL:`, true)
            } else {
                console.error('Incorrect response code or file name not detected', code, fileName);
                this.sendReply(`Failed to download URL: '${this.currentUrl}'. Try again.`);
                this.reset();
            }
        });
    }

    downloadFile(name) {
        const targetPath = process.env.DOWNLOAD_FOLDER + '/' + name;
        const file = createWriteStream(targetPath);

        // Fetch the file & pipe into the destination
        http.get(this.currentUrl, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    const splitName = /^(.+)\.(\w{2,5})$/.exec(name);
                    this.downloadedFile = [ splitName[1], splitName[2] ];
                    this.state = STATE_WAITING_FOR_NAME;
                    console.log(`Downloaded file: ${this.getDownloadedFile()}`);
                    this.sendReply(`Downloaded file '${this.downloadedFile[0]}' (${this.downloadedFile[1]}). Please send new file name (without extension) or type CANCEL:`, true)
                });
            });
        }).on('error', (err) => { // Handle errors
            unlinkSync(targetPath);

            console.error('Failed to download PushBullet file', err);
            this.sendReply(`Failed to download URL: '${this.currentUrl}'. Try again.`);
            this.reset();
        });
    }

    getDownloadedFile() {
        return this.downloadedFile ? `${this.downloadedFile[0]}.${this.downloadedFile[1]}` : undefined;
    }

    getValidName(body) {
        body = body.replace(/\s+/, '');

        if (!body) {
            return undefined;
        }

        if (/[\n\/]+/.test(body)) {
            return undefined;
        }

        if (/^\.+$/.test(body)) {
            return undefined;
        }

        return body;
    }

    reset() {
        this.state = STATE_WAITING_FOR_URL;
        this.downloadedFile = undefined;
        this.currentUrl = undefined;
        this.deletePushes = [];
    }

    /**
     * @param {string} message The message to send the user
     * @param {boolean} [shouldDeletePush] Whether this push should be deleted after the download has been completed
     */
    sendReply(message, shouldDeletePush) {
        axios.post('https://api.pushbullet.com/v2/pushes', {
            type: 'note',
            body: 'BOT: ' + message,
            source_device_iden: this.sourceDeviceId,
            device_iden: this.lastSourceDevice,
        }, {
            headers: {
                'Access-Token': process.env.PUSHBULLET_TOKEN,
            }
        }).then(response => {
            if (shouldDeletePush) {
                this.storePushForDeletion(response.data.iden);
            }
        })
    }

    storePushForDeletion(id) {
        if (process.env.DELETE_PUSHES === 'true') {
            this.deletePushes.push(id);
        }
    }

    cleanPushes() {
        if (this.deletePushes.length) {
            this.deletePushes.forEach(id => {
                console.log('Deleting Push:', id);
                axios.delete(`https://api.pushbullet.com/v2/pushes/${id}`, {
                    headers: {
                        'Access-Token': process.env.PUSHBULLET_TOKEN,
                    }
                })
            })
        }
    }


}