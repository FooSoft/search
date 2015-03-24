#!/usr/bin/env node

/*
 * Copyright (c) 2015 Alex Yatskov <alex@foosoft.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var cheerio = require('cheerio');
var request = require('request');
var url     = require('url');
var path    = require('path');
var fs      = require('fs');
var _       = require('underscore');


function requestCached(relativeUrl, callback) {
    var absoluteUrl = url.resolve('http://www.tripadvisor.com', relativeUrl);
    var cachePath   = path.join('cache', relativeUrl);

    fs.readFile(cachePath, function(err, data) {
        if (err) {
            var stream = fs.createWriteStream(cachePath);
            request(absoluteUrl, callback).pipe(stream);
        }
        else {
            callback(null, null, data);
        }
    });
}

function getBarPercent(bar) {
    var width = bar.css('width');
    return parseInt(width) / 91.0;
}

function reviewScraped(err, resp, html) {
    if (err) {
        return console.error('Error: %s', err);
    }

    var $ = cheerio.load(html);

    var address = $('div.addr').text().trim();
    if (!address) {
        return;
    }

    var storeName = $('h1#HEADING').text().trim();
    if (storeName.indexOf('CLOSED') !== -1) {
        return;
    }

    var bars = $('div.fill');
    if (bars.length !== 9) {
        return;
    }

    var rateFood       = getBarPercent($(bars[5]));
    var rateService    = getBarPercent($(bars[6]));
    var rateValue      = getBarPercent($(bars[7]));
    var rateAtmosphere = getBarPercent($(bars[8]));

    if (rateFood === 0.0 && rateService === 0.0 && rateValue === 0.0 && rateAtmosphere === 0.0) {
        return;
    }

    var data = {
        name:        storeName,
        relativeUrl: this.relativeUrl,
        address:     address,
        rating: {
            food:       (rateFood - 0.5) * 2.0,
            service:    (rateService - 0.5) * 2.0,
            value:      (rateValue - 0.5) * 2.0,
            atmosphere: (rateAtmosphere - 0.5) * 2.0
        }
    };

    this.callback(data);
}

function scrapeReview(relativeUrl, callback) {
    console.log('Scraping review %s...', relativeUrl);

    var c = _.bind(reviewScraped, {
        callback:    callback,
        relativeUrl: relativeUrl
    });
    requestCached(relativeUrl, c);
}

function indexScraped(err, resp, html) {
    if (err) {
        return console.error('Error: %s', err);
    }

    var $     = cheerio.load(html);
    var that  = this;
    var abort = false;

    $('a.property_title').each(function(index, element) {
        if (abort) {
            return;
        }

        var reviewUrl = $(element).attr('href');
        if (that.callback(reviewUrl)) {
            abort = true;
        }
    });

    if (!abort) {
        var nextPageUrl = $('a.sprite-pageNext').attr('href');
        if (nextPageUrl) {
            scrapeIndices(nextPageUrl, this.callback);
        }
    }
}

function scrapeIndices(relativeUrl, callback) {
    console.log('Scraping index %s...', relativeUrl);

    var c = _.bind(indexScraped, { callback: callback });
    requestCached(relativeUrl, c);
}

function main() {
    var relativePath = '/Restaurants-g298173-Yokohama_Kanagawa_Prefecture_Kanto.html';
    var databasePath = 'data.json';

    var abort = false;
    process.on('SIGINT', function() {
        console.warn('Caught SIGINT, aborting...');
        abort = true;
    });

    var results = [];
    scrapeIndices(relativePath, function(relativeUrl) {
        scrapeReview(relativeUrl, function(data) {
            results.push(data);
        });

        return abort;
    });

    process.on('exit', function() {
        var strData = JSON.stringify(results, null, 4);
        fs.writeFileSync(databasePath, strData);
    });
}


if (require.main === module) {
    main();
}