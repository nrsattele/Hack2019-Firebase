const functions = require('firebase-functions');
const request = require('request');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

// called every time a queue is changed
exports.modifyQueue = functions.firestore
    .document('queues/{queueID}')
    .onWrite((change, context) => {
    // Get an object with the current document value.
    // If the document does not exist, it has been deleted.
    const document = change.after.exists ? change.after.data() : null;

    if (document === null) {
        return new Response();
    }

    const token = document['token']
    const playlistID = document['playlistID']

    return new Promise((resolve, reject) => {

        // call spotify, get the playlist
        var options = { method: 'GET',
        url: 'https://api.spotify.com/v1/playlists/' + playlistID,
        headers: { Authorization: 'Bearer '+ token } };

        request(options, (error, response, body) => {
            if (error) {
                console.log(error.code + ": " + error.message);
                throw new Error(error);
            }

            tracks = JSON.parse(body);
            // console.log(tracks);

            try {
                tracks = tracks["tracks"]["items"];

            // eslint-disable-next-line no-catch-shadow
            } catch (error) {
                console.log(error);
            }

            currentlyPlaying(tracks, document);
            console.log('track items')
            console.log(tracks);
        });
    });
});

/**
 * TODO: 
 * 30 sec song lock
 * transactions
 * don't change the zeroth element in the list
 * duplicates
 */

/**
 * Called when done getting playlist
 * @param {Map} trackItems is the list of tracks that exist in the playlist
 * @param {Map} document is the database 
 * @param {Map} currentSong is the JSON response of the currently playing song
 */
function spotifyDone(trackItems, document, currentSong) {

    // checks if currently playing song is from our playlist
    var indexCurrentPlay = isFromOurPlayist(currentSong, document['playlistID'], trackItems)
    console.log('index: ' + indexCurrentPlay)

    // ensures songs will be placed in the correct order
    mySongs = document['songs'];
    mySongs.sort((a,b) => {
        return b['votes'] - a['votes'];
    })

    tracks = [];
    for (i = 0; i < mySongs.length; i ++) {
        var element = mySongs[i];
        var id = element['id']
        // console.log('id: ' + id + ' element:' + element)
        if (i >= trackItems.length || trackItems[i]['track']['id'] !== id) {
            // console.log('i: ' + i + ' add track: ' + id)
            tracks.push(id)
        }
    }

    addTracks(tracks, indexCurrentPlay + 1, document['playlistID'], document['token'])
}

/**
 * addTrack adds track trackID to playlist playlistID at position pos
 * @requires token has access to playlist playlistID
 * @param {[String]} trackIDs is a list of spotify track uris ex: 'spotify:track:5sCvipEhpAhVhu3K6kzm1P'
 * @param {Number} pos is a number indicating the position to place this track into the playlist
 * @param {String} playlistID is the ID of the playlist to add to
 * @param {String} token is the spotify auth token
 */
function addTracks(trackIDs, pos, document) {
    playlistID = document['playlistID']
    token = document['token']
    var uriList = trackURI(trackIDs);
    console.log('uris: ' + uriList);

    // compare playlist order to new document and make changes
    var options = { method: 'POST',
        url: 'https://api.spotify.com/v1/playlists/' + playlistID + '/tracks',
        qs: { uris: uriList, position: pos },
        headers: { Authorization: 'Bearer ' + token } 
    };

    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) throw new Error(error);
            // console.log("posted!")
            if (pos > 1) {
                removeTrack(pos, trackIDs[0], playlistID, token);
            }
        });
    });
}

/**
 * 
 * @param {[String]} trackIDs 
 */
function trackURI(trackIDs) {
    var ans = 'spotify:track:' + trackIDs[0];
    for (let i = 1; i < trackIDs.length; i++) {
        ans += ',spotify:track:' + trackIDs[i];
    }
    return ans;
}

/**
 * 
 * @param {*} trackItems 
 * @param {*} document 
 */
function currentlyPlaying(trackItems, document) {

    /**
     * gets the currently playing song.
     * if context is this playlist then remove all songs before this one (if 10 sec left in current song)
     */
    var token = document['token']
    var options = { method: 'GET',
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: { Authorization: 'Bearer '+ token }
    }; 

    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) throw new Error(error);

            var jsonBody = JSON.parse(body);
            // console.log('currently playing' + body);
            spotifyDone(trackItems, document, jsonBody);
        });
    });
}

/**
 * Returns the index of this element (in json) in the trackItems array
 * @param {Map} playingElement 
 * @param {String} ourId the playlist id of our playlist
 * @param {[Map]} trackItems 
 */
function isFromOurPlayist(playingElement, ourId, trackItems) {
    var uri = playingElement['context']['uri'];
    var elements = uri.split(':')
    var id = elements[elements.length - 1];
    if (id !== ourId) {
        console.log('not the same!')
        return null;
    }

    uri = playingElement['item']['uri'];
    for (let i = 0; i < trackItems.length; i++) {
        const element = trackItems[i]['track'];
        // console.log('uri: ' + uri + ' element: ' + element + ' element[uri]: ' + element['uri'])
        if (element['uri'] === uri) {
            return i;
        }
    }

    console.log('oh no could not find it!')
    return null;
}

/**
 * Removes one track in playlist at index
 * @requires token has access to playlist playlistID
 * @param {Number} pos is a number indicating the position to place this track into the playlist
 * @param {String} id the id of the track to remove
 * @param {String} playlistID is the ID of the playlist to add to
 * @param {String} token is the spotify auth token
 */
function removeTrack(pos, id, playlistID, token) {
    console.log('removing track');
    var options = { method: 'DELETE',
      url: 'https://api.spotify.com/v1/playlists/'+ playlistID +'/tracks',
      qs: { '': '' },
        headers: { Authorization: 'Bearer ' + token },
      body: { 
          tracks: 
          [ { uri: 'spotify:track:' + id,
              positions: [ pos ] },
            ] },
      json: true };
    
    request(options, (error, response, body) => {
      if (error) {
        console.log('bad remove!')
        throw new Error(error);
      }
    
      console.log(body);
    });
    
}
