/*
 * Copyright (c) 2015 <name of copyright holder>
 * Author: Alex Yatskov <alex@foosoft.net>
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

(function(categories) {
    'use strict';

    function guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    function transmitCategories() {
        console.log(categories);
    }

    function displayCategories() {
        var template = Handlebars.compile($('#template').html());

        $('#categories').empty();
        $('#categories').append(template({categories: categories}));

        $('#categories input:radio').change(function() {
            categories[$(this).attr('categoryId')].value = parseInt(this.value);
            transmitCategories();
        });
    }

    function addCategory(description) {
        description = description.trim();
        if (!description) {
            return;
        }

        categories[guid()] = {description: description, value: 0};

        transmitCategories();
        displayCategories();
    }

    function onReady() {
        Handlebars.registerHelper('checkMatch', function(value, options) {
            return new Handlebars.SafeString(value == this.value ? 'checked' : '');
        });

        $.getJSON('/query', _ctx.query, function(results) {
            var profile = {};
            for (var i = 0, length = results.length; i < length; ++i) {
                var result = results[i];
                profile[result.id] = {description: result.description, value: 0};
            }

            $('#addCategory').click(function() {
                addCategory($('#newCategory').val());
            });

            displayCategories();
        });
    }

    $(document).on({
        ajaxStart: function() { $('#spinner').show(); },
        ajaxStop: function() { $('#spinner').hide(); },
        ready: onReady()
    });
})();
