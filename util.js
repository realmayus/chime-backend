function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function check_if_exists(profile, playlist_name) {
    let data = profile.data();
    if(data === undefined) {
        return false
    }
    if(data.hasOwnProperty("playlists")) {
        let playlists = data.playlists
        for(let i = 0; i < playlists.length; i++) {
            let playlist = playlists[i];
            if(playlist.name.toLowerCase() === playlist_name.toLowerCase()) {
                return true;
            }
        }
        return false
    } else {
        return false
    }
}


module.exports = {
    uuidv4: uuidv4,
    check_if_exists: check_if_exists
}