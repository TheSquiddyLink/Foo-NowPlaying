
class BeefWeb {
    
    /**@private */
    options = {
        player: "/player",
    }

    /**@private */
    columns = [
        "%isplaying%",
        "%ispaused%",
        "%album artist%",
        "%album%",
        "%artist%",
        "%title%",
        "%track number%",
        "%length_seconds%",
        "%playback_time_seconds%",
        "%path%",
    ]

    previousItem = new Item();

    activeItem = new Item();

    frequency = 500;

    worker = new Worker("./script/worker.js");

    elements = {
        albumArt: null,
        title: null,
        artist: null,
        album: null,
    }

    constructor(port){
        this.port = port
        this.root = "http://localhost:" + port + "/api"
    }

    /**@private */
    getColumnsQuery() {
        return `?columns=${this.columns.join(",")}`;
    }
    
    /**
     * 
     * @param {MessageEvent<any>} event 
     * @private
     */
    async update(event){
        if (!event || !event.data || !event.data.player?.activeItem) return;
        this.activeItem.update(event.data);

        if(this.activeItem.compare(this.previousItem)) return;
        this.previousItem.from(this.activeItem);
        this.updateSongElements();
    }

    start(){
        this.worker.postMessage({
            url: this.root + this.options.player + this.getColumnsQuery(),
            interval: this.frequency
        });

        this.worker.onmessage = this.update.bind(this);
    }

    init(){
        this.elements.albumArt = document.getElementById("playerArt");
        this.elements.title = document.getElementById("playerTitle");
        this.elements.artist = document.getElementById("playerArtist");
        this.elements.album = document.getElementById("playerAlbum");
    }
    
    /**@private */
    updateSongElements(){
        this.elements.title.innerText = this.activeItem.columns.title;
        this.elements.artist.innerText = this.activeItem.columns.artist;
        this.elements.album.innerText = this.activeItem.columns.album;
    }
}

class Item {
    constructor(data) {
        this.playlist = {};
        this.time = {
            current: 0,
            total: 0,
            percent: () => (this.time.current / this.time.total) * 100
        };
        this.columns = {};
        if(data) this.update(data);
    }

    update(data) {
        if (!data?.player?.activeItem) return;
        let activeItem = data.player.activeItem;

        this.playlist.id = activeItem.playlistId;
        this.playlist.index = activeItem.playlistIndex;
        this.songIndex = activeItem.index;

        this.time.current = activeItem.position;
        this.time.total = activeItem.duration;

        this.columns.isPlaying = activeItem.columns?.[0] ?? false;
        this.columns.isPaused = activeItem.columns?.[1] ?? false;
        this.columns.albumArtist = activeItem.columns?.[2] ?? "Unknown";
        this.columns.album = activeItem.columns?.[3] ?? "Unknown";
        this.columns.artist = activeItem.columns?.[4] ?? "Unknown";
        this.columns.title = activeItem.columns?.[5] ?? "Unknown";
        this.columns.trackNumber = activeItem.columns?.[6] ?? 0;
        this.columns.length = activeItem.columns?.[7] ?? 0;
        this.columns.elapsed = activeItem.columns?.[8] ?? 0;
        this.columns.path = activeItem.columns?.[9] ?? "";
    }

    /**
     * 
     * @param {Item} item 
     */
    from(item) {
        Object.assign(this.playlist, item.playlist);
        Object.assign(this.time, item.time);
        Object.assign(this.columns, item.columns);

        this.songIndex = item.songIndex;
    }

    /**@param {Item} item  */
    compare(item) {
        if (!(this instanceof Item) || !(item instanceof Item)) return false;
        
        return (
            this.songIndex === item.songIndex &&
            this.time.current === item.time.current &&
            this.time.total === item.time.total &&
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album &&
            this.columns.isPlaying === item.columns.isPlaying
        );
    }
    
}



document.addEventListener("DOMContentLoaded", () => {
    const beef = new BeefWeb(8880);

    beef.init();

    beef.start();
})