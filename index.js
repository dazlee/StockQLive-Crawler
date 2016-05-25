"use strict";
const request = require("request");
const cheerio = require("cheerio");


// connect to mongodb
const mongoose = require("mongoose");
function connectToMongo () {
    return new Promise((resolve, reject) => {
        mongoose.connect("mongodb://localhost:27017/cha", (error) => {
            if (error) {
                console.log("cannot connect to mongo db");
                reject(error);
                return;
            }

            console.log("connect to mongo db");
            resolve();
        });
    });
}

const Schema = mongoose.Schema;
const SubjectSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    uri: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    postedAt: {
        type: Date,
        required: true,
    },
    html: {
        type: String,
        required: true,
    },
    likes: {
        type: Number,
        default: 0,
    },
    dislikes: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: {
        createdAt: "createdAt",
        updatedAt: "updatedAt",
    }
});

const SubjectModel = mongoose.model("Subject", SubjectSchema);


function checkSubject (attributes, next) {
    SubjectModel.count({postedAt: attributes.postedAt}, (error, count) => {
        if (error) {
            console.log(error);
        } else if (count == 0) {
            next();
        }
    });
}
function saveSubject (attributes) {
    SubjectModel.create(attributes, (error, subject) => {
        if (error) {
            console.log("failed to save", error);
            return;
        }
        console.log("successful to save");
    });
}

// https://www.ptt.cc/bbs/Stock/index.html
var count = 10;
var startPrev = 3026;
var subjectRegex = /^\[標的\].*/;
function crawPTTStock (url) {
    sendRequest(url, function (error, r, content) {
        if(error) {
            console.log(error);
            return;
        }

        const $ = cheerio.load(content);
        const pagingButtons = $('div.btn-group-paging .btn');
        const prevBtn = $(pagingButtons[1]);
        //const prevLink = prevBtn.attr('href');
        const list = $("div.r-list-container .r-ent");
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const a = $(item).find('.title a');
            const title = a.text();
            if (subjectRegex.test(title)) {
                console.log(title);
                const uri = domain + a.attr("href");
                const date = $(item).find('.meta .date').text();
                const author = $(item).find('.meta .author').text();

                crawPTTStockDetail({
                    name: title,
                    uri: uri,
                    author: author,
                });
            }
        }

        count--;
        if (count > 0) {
            const prevLink = `/bbs/Stock/index${startPrev}.html`;
            crawPTTStock(domain + prevLink);
            startPrev--;
        }
    });
}
function crawPTTStockDetail(attributes) {
    sendRequest(attributes.uri, function (error, r, content) {
        if (error) {
            console.log("fail to fetch ", error);
            return;
        }
        const $ = cheerio.load(content);
        const metaline = $("div.article-metaline .article-meta-value");
        const dateString = $(metaline[2]).text();
        if (!dateString) return;

        const date = new Date(dateString);
        const newAttributes = Object.assign({}, attributes, {
            postedAt: date,
            html: content,
        });
        checkSubject(newAttributes, () => {
            saveSubject(newAttributes);
        });
    });
}
function sendRequest (url, callback) {
    request({
        url: url,
        method: "GET"
    }, callback);
}

const domain = "https://www.ptt.cc";
const root = "/bbs/Stock/index.html";

connectToMongo()
    .then(() => {
        crawPTTStock(domain + root);
    })
    .catch((error) => {
        console.log(error);
    });
