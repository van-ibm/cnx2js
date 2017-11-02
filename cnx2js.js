'use strict'

const xml2js = require('xml2js')
const parseString = xml2js.parseString

// set up logging
const logger = require('winston')

/**
 * Parses the GUID of the artifact from a longer Connections ID.
 * For example urn:lsid:ibm.com:blogs:entry-322fc9c0-1b7c-4269-87ce-cf1b233a9c32
 * becomes 322fc9c0-1b7c-4269-87ce-cf1b233a9c32.
 *
 * @private
 * @param {string} id
 * @returns {string}
 */
function parseId (id) {
  // urn:lsid:ibm.com:communities:remoteapplication-Wce55b9d5d3ac_45de_9258_d2688b449cf5
  // urn:lsid:ibm.com:blogs:comment-322fc9c0-1b7c-4269-87ce-cf1b233a9c32
  // urn:lsid:ibm.com:blogs:entry-322fc9c0-1b7c-4269-87ce-cf1b233a9c32
  // tag:profiles.ibm.com,2006:entry322fc9c0-1b7c-4269-87ce-cf1b233a9c32
  const tokens = ['remoteapplication-', 'comment-', 'entry-', 'entry']

  for (let i in tokens) {
    if (id.includes(tokens[i])) {
      return id.substring(id.indexOf(tokens[i]) + tokens[i].length)
    }
  }

  // urn:lsid:ibm.com:forum:c9f8dd75-74d6-4906-9a3f-6e63a22718bf
  if (id.lastIndexOf(':')) {
    return id.substring(id.lastIndexOf(':') + 1)
  }

  logger.error(`error parsing ID from ${id}`)

  return id
}

  /**
  * Creates a JSON object for an individual item given an entry from
  * ATOM XML.
  *
  * @private
  * @param {string} entry
  * @returns {Object}
  */
function createEntry (entry) {
  var result = {}

  if (entry.id) {
    result.id = parseId(entry.id[0])

    // urn:lsid:ibm.com:blogs:entry-322fc9c0-1b7c-4269-87ce-cf1b233a9c32
    // urn:lsid:ibm.com:forum:c9f8dd75-74d6-4906-9a3f-6e63a22718bf
    // urn:lsid:ibm.com:td:a86b33cd-deb3-4afd-b98f-9338375a751b
    if (entry.id[0].includes('blogs')) {
      result.source = 'blog'
    } else if (entry.id[0].includes('forum')) {
      result.source = 'forum'
    } else if (entry.id[0].includes('td')) {
      result.source = 'wiki'
    } else {
      result.source = entry.id[0]
    }
  }

  if (entry.title) {
    result.title = entry.title[0]._
  }

  if (entry.author) {
    result.author = {
      name: entry.author[0].name[0],
      id: entry.author[0]['snx:userid'][0]._
    }
  }

  if (entry.category) {
    var categories = []

    for (let i in entry.category) {
      categories.push(entry.category[i].$.term)
    }

    result.categories = categories
  }

  if (entry.published) {
    result.published = entry.published[0]
  }

  if (entry.hasOwnProperty('thr:in-reply-to')) {
    result.parent = parseId(entry['thr:in-reply-to'][0].$.ref)
  }

  if (entry.hasOwnProperty('snx:communityUuid')) {
    if (entry['snx:communityUuid'].length) {
      result.parent = entry['snx:communityUuid'][0]._
    }
  }

  if (entry.hasOwnProperty('td:library')) {
    result.parent = entry['td:library'][0]['snx:communityUuid'][0]
  }

  // wiki page version
  if (entry.hasOwnProperty('td:versionUuid')) {
    result.version = entry['td:versionUuid'][0]
  }

  // TODO validate links in other types like tags
  if (entry.link) {
    for (let i in entry.link) {
      switch (entry.link[i].$.type) {
        case 'application/atom+xml':
          if (entry.link[i].$.rel && entry.link[i].$.rel === 'self') {
            result.api = entry.link[i].$.href
          } else
          // likes
          if (entry.link[i].$.rel && entry.link[i].$.rel === 'recommendations') {
            result.recommendations = parseInt(entry.link[i].$['snx:recommendation'], 10)
          }
          break
        case 'text/html':
          // defines the link a web user should use
          if (entry.link[i].$.rel === 'alternate') {
            result.url = entry.link[i].$.href
          }
          break
      }
    }
  }

  // undefined when the entry has no content
  if (entry.content) {
    // the content could be HTML or a link to download the HTML
    if (entry.content[0].$ && entry.content[0].$.src) {
      // the caller of the formatter will be responsible for getting the
      // real content referenced by this URL
      result.content = entry.content[0].$.src
    } else {
      result.content = entry.content[0]._
    }
  } else {
    if (entry.term) {
      result.content = entry.term
    } else {
      result.content = ''
    }
  }

  // TODO type is an array what are the other possible indexes
  if (entry.summary) {
    if (entry.summary.length) {
      result.summary = entry.summary[0]._
    }
  }

  logger.debug('formatted entry ' + JSON.stringify(result, null, 2))

  return result
}

  /**
  * Converts Connections ATOM XML into JSON.
  * JSON objects are place in a named list defined by the name parameter.
  *
  * @private
  * @param {string} xml - ATOM XML
  * @param {string} name - JSON list property
  * @returns {Function} callback - callback function
  */
function format (xml, name, callback) {
  logger.debug(`parsing XML ${xml}`)
  parseString(xml, name, (err, result) => {
    if (err) {
      logger.error('Failed to convert XML to JSON')
      return callback(err)
    } else {
      // whether the XML has one or many entries, the result will always
      // be a list
      var formatted = {}
      formatted[name] = []

      // convert the XML to intermediate JSON for processing
      logger.debug('formatting ' + JSON.stringify(result, null, 2))

      // check if this is a feed (ie multiple entries)
      if (result.feed !== undefined) {
        var entries = result.feed.entry

        // wikis for example do not list the community source in the entry
        // so get it from the feed and add it manually to each entry
        var communityId
        if (result.feed.hasOwnProperty('snx:communityUuid')) {
          communityId = result.feed['snx:communityUuid'][0]
        }

        for (let i in entries) {
          var entry = createEntry(entries[i])

          // only add it to the wiki entry
          if (communityId && entry.source === 'wiki') {
            entry.parent = communityId
          }

          formatted[name].push(entry)
        }
      } else if (result.entry !== undefined) {
        // only a single entry
        let entry = result.entry

        formatted[name].push(createEntry(entry))
      } else if (result['app:categories'] !== undefined) {
        // multiple items - typically terms like in profile tags
        let entries = result['app:categories']['atom:category']

        for (let i in entries) {
          formatted[name].push(createEntry(entries[i].$))
        }
      } else {
        // unknown type
        callback({error: `Unknown result ${JSON.stringify(result)}`})
      }

      logger.debug('formatted ' + JSON.stringify(formatted, null, 2))

      callback(null, formatted)
    }
  })
}

module.exports.format = format

module.exports.level = level => {
  logger.level = level
}
