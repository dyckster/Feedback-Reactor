require('dotenv').config();
const request = require('request');
const admin = require('firebase-admin');
const serviceAccount = require('./service-key.json');
const fs = require('fs');
const textHelper = require('./text_helper.js');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

const SAVED_IDS_FILE = "saved_ids.txt"
const TRELLO_CREATE_CARD_URL = 'https://api.trello.com/1/cards'

const processedFeedbackLogger = fs.createWriteStream(SAVED_IDS_FILE, {
    flags: 'a' // 'a' means appending (old data will be preserved)
});
const processedFeedbackIds = fs.readFileSync(SAVED_IDS_FILE, "utf8");

const firebaseDatabase = admin.database();
const feedbackReference = firebaseDatabase.ref(process.env.FIREBASE_FEEDBACK_REFERENCE);

feedbackReference.on('child_added', function (childSnapshot) {
    const feedbackId = childSnapshot.key;
    if (processedFeedbackIds.includes(feedbackId)) {
        console.log("This feedback was already logged");
        return;
    }
    const feedbackValue = childSnapshot.val();
    feedbackValue.id = feedbackId;
    prepareTrelloRequest(feedbackValue);
});

function prepareTrelloRequest(feedbackValue) {
    const cardName = textHelper.getPrettyFeedbackNameForType(
        feedbackValue.feedbackType
    );
    const cardDescription = textHelper.getPrettyFeedbackDescription(
        feedbackValue
    );
    sendTrelloRequest(feedbackValue, cardName, cardDescription);
}

function sendTrelloRequest(
    feedbackValue,
    cardName,
    cardDescription
) {
    const query = {
        key: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
        name: cardName,
        desc: cardDescription,
        pos: "top",
        idList: process.env.FEEDBACK_LIST_ID,
        idMembers: process.env.ASSIGNEE_ID
    }
    const requestOptions = {
        url: TRELLO_CREATE_CARD_URL,
        qs: query
    }
    request.post(requestOptions, (err, res, body) => {
        if (err || body.ok === false) {
            return console.log(err);
        }
        const jsonBody = JSON.parse(body);
        prepareTelegramRequest(feedbackValue, cardDescription, jsonBody.shortUrl);
    })
}

function prepareTelegramRequest(
    feedbackValue,
    prettyFeedback,
    trelloCardUrl
) {
    const feedbackTitle = textHelper.getPrettyFeedbackNameForType(
        feedbackValue.feedbackType
    );
    const textBody = `
New Feedback: ${feedbackTitle}
${prettyFeedback}`
    const keyboard = createInlineKeyboard(feedbackValue, trelloCardUrl);
    sendFeedbackToChannel(feedbackValue.id, textBody, keyboard);
}

/**
 * Create buttons in telegram message. Trello ticket button and button to find user in firebase.
 * @param feedback object
 * @param trelloCardUrl - short trello card url
 * @returns {string} with formatted JSON data for inline keyboard
 */
function createInlineKeyboard(feedback, trelloCardUrl) {
    const firstRow = []
    if (feedback.userId) {
        const firebaseBaseUrl = process.env.FIREBASE_DATABASE_URL;
        const usersReference = process.env.FIREBASE_USERS_REFERENCE;
        const userUrl = `${firebaseBaseUrl}/${usersReference}/${feedback.userId}`
        firstRow.push({
            "text": "🙋User in FIREBASE",
            "url": userUrl
        })
    }
    if (trelloCardUrl) {
        firstRow.push({
            "text": "🎫 TRELLO ticket",
            "url": trelloCardUrl
        })
    }

    const keyboard = {
        "inline_keyboard": [
            firstRow
        ]
    }

    return JSON.stringify(keyboard);
}

function sendFeedbackToChannel(feedbackId, prettyFeedback, keyboard) {
    const botApiKey = process.env.TELEGRAM_BOT_API_KEY;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const url = `https://api.telegram.org/bot${botApiKey}/sendMessage?chat_id=${chatId}&text=${prettyFeedback}&parse_mode=Markdown&reply_markup=${keyboard}`
    const encoded = encodeURI(url);
    request(encoded, {
        json: true
    }, (err, res, body) => {
        if (err || body.ok === false) {
            return console.log(err);
        }
        processedFeedbackLogger.write(`${feedbackId}\n`);
    });
}
