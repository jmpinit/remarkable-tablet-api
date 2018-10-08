const fetch = require('node-fetch');
const uuid4 = require('uuid4');

const userAgent = 'remarkable-tablet-api';

function queryString(params) {
  // https://github.com/github/fetch/issues/256#issuecomment-241613757
  const esc = encodeURIComponent;
  return Object.keys(params)
    .map(k => `${esc(k)}=${esc(params[k])}`)
    .join('&');
}

async function authenticateDevice(code) {
  const defaultDescription = 'desktop-linux';

  const deviceID = uuid4();

  const res = await fetch('https://my.remarkable.com/token/json/2/device/new', {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
      Authentication: 'Bearer',
    },
    body: JSON.stringify({
      code,
      deviceDesc: defaultDescription,
      deviceID,
    }),
  });

  const token = await res.text();

  if (token.startsWith('Invalid One-time-code')) {
    throw new Error('Invalid one-time code');
  } else if (token.startsWith('Unknown device type (desc)')) {
    throw new Error('Unknown device type');
  } else if (token.startsWith('You have been signed out. Please update your app to log in again.')) {
    // https://github.com/splitbrain/ReMarkableAPI/issues/9
    throw new Error('Using wrong API version');
  }

  return { deviceID, token };
}

async function authenticateUser(token) {
  const newToken = await fetch('https://my.remarkable.com/token/json/2/user/new', {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      Authorization: `Bearer ${token}`,
    },
  });

  if (newToken.status !== 200) {
    throw new Error(`User authentication failure: ${newToken.status}`);
  }

  return newToken.text();
}

async function getStorageHost() {
  const query = queryString({
    environment: 'production',
    group: 'auth0|5a68dc51cb30df3877a1d7c4',
    apiVer: 2,
  });

  const documentStorageUrl = 'https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1/document-storage';
  const res = await fetch(`${documentStorageUrl}?${query}`);
  const value = await res.json();

  if (value.Status !== 'OK') {
    throw new Error(`Unexpected status in response: "${value.Status}"`);
  }

  return `https://${value.Host}`;
}

async function docs(storageHostUrl, token, opts) {
  const { id, withBlob } = opts || {};

  const query = opts === undefined
    ? ''
    : queryString({
      doc: id,
      withBlob: !!withBlob,
    });

  const endpointUrl = `${storageHostUrl}/document-storage/json/2/docs?${query}`;

  const res = await fetch(endpointUrl, {
    headers: {
      'User-Agent': userAgent,
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
}

async function uploadRequest(storageHostUrl, token) {
  const endpointUrl = `${storageHostUrl}/document-storage/json/2/upload/request`;

  const docId = uuid4();

  const docInfo = [{
    ID: docId,
    Type: 'DocumentType',
    Version: 1,
  }];

  const res = await fetch(endpointUrl, {
    method: 'PUT',
    headers: {
      'User-Agent': userAgent,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(docInfo),
  });

  const data = await res.json();

  data.forEach((datum) => {
    if (datum.Success !== true) {
      throw new Error(`Upload request failed: "${datum.Message}"`);
    }
  });

  const uploadUrls = data.map(datum => datum.BlobURLPut);

  if (uploadUrls.length !== 1) {
    throw new Error('Unexpected number of upload URLs returned');
  }

  return { docId, uploadUrl: uploadUrls[0] };
}

// { id, version, dateModified, type, visibleName, currentPage, bookmarked, parent }
async function updateStatus(storageHostUrl, token, metadata) {
  const endpointUrl = `${storageHostUrl}/document-storage/json/2/upload/update-status`;

  const validatedMetadata = [{
    ID: metadata.id,
    Version: metadata.version,
    ModifiedClient: metadata.dateModified,
    Type: metadata.type,
    VissibleName: metadata.visibleName,
    CurrentPage: metadata.currentPage,
    Bookmarked: metadata.bookmarked,
    Parent: metadata.parent,
  }];

  return fetch(endpointUrl, {
    method: 'PUT',
    headers: {
      'User-Agent': userAgent,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(validatedMetadata),
  });
}

async function deleteItem(storageHostUrl, token, id, version) {
  const endpointUrl = `${storageHostUrl}/document-storage/json/2/delete`;

  const data = [{
    ID: id,
    Version: version,
  }];

  return fetch(endpointUrl, {
    method: 'PUT',
    headers: {
      'User-Agent': userAgent,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

module.exports = {
  authenticateDevice,
  authenticateUser,
  getStorageHost,
  docs,
  uploadRequest,
  updateStatus,
  deleteItem,
};
