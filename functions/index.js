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

            spotifyDone(tracks, document);
        });
    });
});

/**
 * Called when done getting playlist
 * @param {Map} trackItems is the list of tracks that exist in the playlist
 * @param {Map} document is the database 
 */
function spotifyDone(trackItems, document, token) {
    // console.log("SPOTIFY DONE");
    // console.log(trackItems);
    // console.log(mySongs);
    mySongs = document['songs']

    for (i = 0; i < mySongs.length; i ++) {
        var element = mySongs[i];
        var id = element['id']
        console.log('id: ' + id + ' element:' + element)
        if (i >= trackItems.length || trackItems[i]['track']['id'] !== id) {
            console.log('i: ' + i + ' add track: ' + id)
            addTrack(id, i, document['playlistID'], document['token'])
        }
    }
}

/**
 * addTrack adds track trackID to playlist playlistID at position pos
 * @requires token has access to playlist playlistID
 * @param {String} trackID is a spotify track uri ex: 'spotify:track:5sCvipEhpAhVhu3K6kzm1P'
 * @param {Number} pos is a number indicating the position to place this track into the playlist
 * @param {String} playlistID is the ID of the playlist to add to
 * @param {String} token is the spotify auth token
 */
function addTrack(trackID, pos, playlistID, token) {
    trackURI = 'spotify:track:' + trackID
    // compare playlist order to new document and make changes
    var options = { method: 'POST',
        url: 'https://api.spotify.com/v1/playlists/' + playlistID + '/tracks',
        qs: { uris: trackURI, position: pos },
        headers: { Authorization: 'Bearer '+ token } 
    };

    request(options, (error, response, body) => {
        if (error) throw new Error(error);
        console.log("posted!")
    });

}
