# cnx2js

Converts (some) IBM Connections Cloud ATOM XML to JSON.

## Usage
```javascript
var cnx2js = require('@ics-demo/cnx2js');
cnx2js.format(xml, 'topics', (err, json) => {
    console.log(json);
});
```

```
{
  "topics": [
    {
      "id": "eba13222-c22a-4529-bb43-badc700c11c3",
      "source": "forum",
      "title": "How will Internet of Things affect collaboration?",
      "parent": "658dcc36-6d2d-4508-9dc8-87332fbbab19",
      "api": "https://apps.na.collabserv.com/communities/service/atom/community/instance?communityUuid=658dcc36-6d2d-4508-9dc8-87332fbbab19",
      "url": "https://apps.na.collabserv.com/forums/html/topic?id=eba13222-c22a-4529-bb43-badc700c11c3",
      "content": "\n    <p dir=\"ltr\">\n      Will devices be able to monitor and react to social collaboration like status updates and posts?\n    </p>\n  "
    },
    ...
    ]
  }
```
## Coverage
* Blog Entries
* Forum Topics
* Comments
* Profile Tags
* Wiki Pages
