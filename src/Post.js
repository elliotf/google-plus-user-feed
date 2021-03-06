'use strict'

var misc = require('./misc')

module.exports = function(rawItem, style) {
    style = style || {}
    style.title = style.title || 'cut'
    this.url = rawItem.url
    this.title = postTitle(rawItem, style.title, style.includeAttachmentType)
    this.content = body(rawItem)
    this.updated = new Date(rawItem.updated)
    this.author = rawItem.actor.displayName
}

var firstSentence = function(string) {
    if (! string) return string;
    // split sentences, from http://stackoverflow.com/a/11127276/74919
    var re = /[^\r\n.!?]+(:?(:?\r\n|[\r\n]|[.!?])+|$)/gi;
    var first = string.match(re)[0];
    var sentence = (function() {
        if (first) {
                return first;
            } else {
                return string;
            }
    })()
    var re = /(^|\s)#([^ ]*)/gi;
    var matches = string.match(re);
    var addons = (function() {
        if (matches) {
            var tags = [];
            matches.each(function(item) {
                if (sentence.match(item)) return;
                if (process.env.IGNORE_TAG) {
                    var ignore = '#' + process.env.IGNORE_TAG;
                    if (item.match(ignore)) {
                        return;
                    }
                }
                tags.push(item.trim());
            })
            return tags.join(' ');
        } else return " ";
    })()
    return [sentence,addons].join(' ');

}

var formatLink = function(attachment) {
    var a = attachment;
    var head = (function() {
        if (attachment.displayName) {
            if (attachment.url) return '<a href="' + attachment.url + '">'+ attachment.displayName + '</a>';
            return '<h3>' + attachment.displayName + '</h3>';
        }
        return "Attached Article";
    })()
    var content = (function() {
        if (attachment.content) return attachment.content;
        return " ";
    })()
    var image = (function() {
        if (attachment.fullImage) return '<img src="' + attachment.fullImage.url + '" width="300" />';
        else if (attachment.image) return '<img src="' + attachment.image.url + '" width="300" />';
        return " ";
    })()

    var link = head + '<p>'+ content + '</p>' + image;

    return link
}

var formatPhoto = function(attachment) {
    var alt = (function() {
        if (attachment.content) return attachment.content;
        return "attached image";
    })()
    var image = (function() {
        if (attachment.image) return '<img src="' + attachment.image.url + '" max-height="' + attachment.image.height + 'px" alt="'+ alt + '" />';
        else if (attachment.fullImage) return '<img src="' + attachment.fullImage.url + '" max-width="100px" max-height="100px" alt="'+ alt + '" />';
        return " ";
    })()
    return image;
}

var formatVideo = function(attachment) {
    var a = attachment;
    var head = (function() {
        if (attachment.displayName) {
            if (attachment.url) return '<a href="' + attachment.url + '">'+ attachment.displayName + '</a>';
            return '<h3>' + attachment.displayName + '</h3>';
        }
        return "Attached Video";
    })()
    var content = (function() {
        if (attachment.content) return attachment.content;
        return " ";
    })()
    var video = (function() {
        // Embedding is not working, need to figure this out.
        if (false) return '<object src="' + attachment.embed.url + '" type="' + attachment.embed.type + '"></object>';
        else if (attachment.image) {
            return '<img src="' + attachment.image.url + '" max-height="' + attachment.image.height + 'px" />';
        }
        return " ";
    })()

    var link = head + '<p>'+ content + '</p>' + video;

    return link
}

var body = function(item) {
    var body = item.annotation || item.object.content || item.title || item.object.title || ''
    body = '<p>' + body + '</p>'

    var type = ''
    if (item.object.attachments) {
        type = (function() {
            if (item.object.attachments[0].objectType === 'article') {
                return formatLink(item.object.attachments[0])
            }
            if (item.object.attachments[0].objectType === 'photo') {
                return formatPhoto(item.object.attachments[0])
            }
            if (item.object.attachments[0].objectType === 'video') {
                return formatVideo(item.object.attachments[0])
            }
        })()
        if (type) type = '<div>' + type + '</div>'
    }

    return body + type;
}

var postTitle = function(item, titleStyle, includeAttachmentType) {
    var belongsToPhotoAlbum = function() {
        return item.object.attachments &&
            item.object.attachments.any(function(a) { 
                return a.objectType === 'photo-album' 
            })
    }

    var userAnnotation = function() {
        if (item.verb === 'share' && item.annotation) {
            return misc.htmlToPlain(item.annotation)
        }
    }

    var titleFromAttachments = function() {
        if (item.object.attachments) {
            for (var i = 0; i < item.object.attachments.length; i++) {
                title = item.object.attachments[i].displayName
                if (title) return title
            }
        }
    }

    var content = function() {
        return misc.htmlToPlain(item.object.content)
    }

    var title = userAnnotation()

    // When item is an album photo G+ uses the album title as the content, but 
    // we'll prefer photo's own annotation
    if (! title && ! belongsToPhotoAlbum()) title = content() 

    if (! title) title = titleFromAttachments()

    if (! title && belongsToPhotoAlbum()) title = content()

    if (! title) title = '' // Avoid undefineds

    title = (function() {
        switch (titleStyle) {
            case 'cut': return misc.cut(title, 100)
            case 'first-sentence': return firstSentence(title)
        }
    })()

    if (includeAttachmentType) {
        var type = attachmentType(item)
        if (type) title += ' [' + type + ']'
    }

    return title;
}

var attachmentType = function(item) {
    if (item.object.attachments) {
        if (item.object.attachments.some(function(a) { return a.objectType === 'article' })) return 'link'
        if (item.object.attachments.any(function(a) { return a.objectType === 'photo' })) return 'photo'
        if (item.object.attachments.any(function(a) { return a.objectType === 'video' })) return 'video'
    }
}
