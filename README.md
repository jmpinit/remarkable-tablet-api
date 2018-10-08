# ReMarkable Tablet Cloud API Node.js Package

Upload and download documents to [ReMarkable](https://remarkable.com/) tablets via their official cloud in Node.js.

If you are looking for a friendly command line tool for interacting with the Remarkable tablet API I recommend [juruen/rmapi](https://github.com/juruen/rmapi).

Thanks to [splitbrain/ReMarkableAPI](https://github.com/splitbrain/ReMarkableAPI/) and [juruen/rmapi](https://github.com/juruen/rmapi) for showing how to use the API.

## Examples

To run the following successfully you will need to set the value of `oneTimeCode` to a code generated on [this page](https://my.remarkable.com/generator-device). In a real app you would want to cache the user token
instead of having the user get a fresh one-time code every time they run the app.

```javascript
const oneTimeCode = /* Set to generated code */;

const { token } = await authenticateDevice(code);
const userToken = await authenticateUser(token);

const storageHost = await getStorageHost();
const docList = await docs(storageHost, userToken);

// Should print a list of metadata for all of your documents
console.log(docList);
```

Uploading documents is a little more involved because they are zip files containing special metadata files.
Make sure to change 'some-document.pdf' to the path of a document on your filesystem before trying,
and don't forget the one-time code.

```javascript
const path = require('path');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

async function upload(storageHostUrl, token, pdfPath) {
  // Create the special zip archive with minimal metadata files

  const docZip = new AdmZip();

  const metadata = {
    extraMetadata: {},
    fileType: 'pdf',
    lastOpenedPage: 0,
    lineHeight: -1,
    margins: 180,
    textScale: 1,
    transform: {},
  };

  docZip.addFile(`${docId}.content`, Buffer.from(JSON.stringify(metadata)));
  docZip.addFile(`${docId}.pagedata`, Buffer.from(''));
  docZip.addLocalFile(pdfPath, '', `${docId}.pdf`);

  const docBuffer = docZip.toBuffer();

  // Get a new document ID and associated upload URL
  const { docId, uploadUrl } = await uploadRequest(storageHostUrl, token);

  // Actually upload the data
  await fetch(uploadUrl, {
    method: 'PUT',
    body: docBuffer,
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  return updateStatus(storageHostUrl, token, {
    id: docId,
    parent: '',
    visibleName: path.basename(pdfPath, path.extname(pdfPath)),
    version: 1,
    type: 'DocumentType',
    dateModified: (new Date()).toISOString(),
  });
}

async function main() {
  const oneTimeCode = /* Set to generated code */;

  const { token } = await authenticateDevice(oneTimeCode);
  const userToken = await authenticateUser(token);

  const storageHost = await getStorageHost();
  await upload(storageHost, userToken, './some-document.pdf');
}

main();
```

## API

* `authenticateDevice(oneTimeCode)` - obtains a device auth token using a one-time code generated [on the ReMarkable website](https://my.remarkable.com/generator-device). Also returns the unique device ID chosen during the request.
* `authenticateUser(token)` - obtains a user auth token using the auth token returned by authenticateDevice.
* `getStorageHost()` - gets the storage API host.
* `docs(storageHostUrl, userToken, opts)` - gets information about documents. If `opts` contains an `id` key with the value set to the ID of a particular document then only information for that document will be returned. If `opts` contains a `withBlob` key with a truthy value then the returned metadata will list URLs where the documents can be downloaded (see `BlobURLGet` key).
* `uploadRequest(storageHostUrl, userToken)` - requests upload. Returns a document ID to use (`docId`) and an upload URL (`uploadUrl`) where a document can be uploaded using a PUT request. See example above for usage.
* `updateStatus(storageHostUrl, userToken, docMetadata)` - Updates the metadata for a document. Optional values: `{ id, version, dateModified, type, visibleName, currentPage, bookmarked, parent }`.
* `deleteItem(storageHostUrl, userToken, docId, docVersion)` - deletes a particular document at a particular version.

## Document Metadata Format

Here is what the metadata for a regular document might look like (yes their API uses an incorrect spelling of "Visible"):

```json
{
  "ID": "3e3314fe-1540-4c70-8dce-a0d5c3a93b08",
  "Version": 2,
  "Message": "",
  "Success": true,
  "BlobURLGet": "",
  "BlobURLGetExpires": "0001-01-01T00:00:00Z",
  "ModifiedClient": "2018-03-01T15:37:33Z",
  "Type": "DocumentType",
  "VissibleName": "Cool Research Paper",
  "CurrentPage": 0,
  "Bookmarked": false,
  "Parent": "0d0ee231-e51f-4328-a523-b2317166770d"
}
```

Here is what the metadata for a "directory" might look like:

```json
{
  "ID": "9d1abccf-41c2-4f04-87e1-a3c2cdef2c43",
  "Version": 1,
  "Message": "",
  "Success": true,
  "BlobURLGet": "",
  "BlobURLGetExpires": "0001-01-01T00:00:00Z",
  "ModifiedClient": "2018-03-02T02:06:08.83625Z",
  "Type": "CollectionType",
  "VissibleName": "Research Papers",
  "CurrentPage": 0,
  "Bookmarked": false,
  "Parent": ""
}
```
