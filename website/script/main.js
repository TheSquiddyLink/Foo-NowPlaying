
class BeefWeb {
    
    /**@private */
    options = {
        player: "/player",
        artwork: "/artwork/current"
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
        player: null,
        data: {
            albumArt: null,
            title: null,
            artist: null,
            album: null,
        },
        progress: {
            current: null,
            total: null,
            bar: null,
        }
    }

    colorThief = new ColorThief();

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

        if(this.compareAll()){
            console.log("No changes detected");
        } else if(this.compareTrack()){
            console.log("Only time changed");
            this.updateTime();
        } else {
            console.log("Track changed");
            this.updateAll();
        }

        this.previousItem.from(this.activeItem);
    }

    start(){
        this.worker.postMessage({
            url: this.root + this.options.player + this.getColumnsQuery(),
            interval: this.frequency
        });

        this.worker.onmessage = this.update.bind(this);
        this.updateAll();
    }

    init(){
        this.elements.player = document.getElementById("player");

        this.elements.data.albumArt = document.getElementById("playerArt");
        this.elements.data.title = document.getElementById("playerTitle");
        this.elements.data.artist = document.getElementById("playerArtist");
        this.elements.data.album = document.getElementById("playerAlbum");

        this.elements.progress.current = document.getElementById("progressCurrent");
        this.elements.progress.total = document.getElementById("progressTotal");
        this.elements.progress.bar = document.getElementById("progressBar");
    }
    
    /**@private */
    updateAll(){
        this.elements.data.title.innerText = this.activeItem.columns.title;
        this.elements.data.artist.innerText = this.activeItem.columns.artist;
        this.elements.data.album.innerText = this.activeItem.columns.album;
        
        this.elements.data.albumArt.src = this.root + this.options.artwork + "?a=" + new Date().getTime();
        this.getCommonColor();
        this.updateTime();
    }

    /**@private */
    updateTime(){
        this.elements.progress.current.innerText = this.formatTime(this.activeItem.time.current);
        this.elements.progress.total.innerText = this.formatTime(this.activeItem.time.total);
        this.elements.progress.bar.style.width = this.activeItem.time.percent() + "%";
        console.log(this.activeItem.color)
        this.elements.player.style.backgroundColor = this.activeItem.color;
    }

    /**@private */
    compareAll(){
        return this.activeItem.compareAll(this.previousItem);
    }

    /**@private */
    compareTrack() {
        return this.activeItem.compareTrack(this.previousItem);
    }

    /**@private */
    formatTime(seconds){
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`; 
    }

    /**@private */
    getCommonColor(){
        console.log("Getting color")
        const onLoad = (img) => {
            try {
                this.activeItem.setColor(this.colorThief.getPalette(img,5));
            } catch (error) {
                console.error(error);
            }
        }
        const img = this.elements.data.albumArt;
        img.crossOrigin = "anonymous";
        if (img.complete) {
            onLoad(img);
        } else {
            img.addEventListener('load', function() {
                onLoad(img);
            });
        }
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
        this.color = null;
    }


    /**
     * 
     * @param {Array<[number,number,number]>} colors
     */
    setColor(colors){
        const filteredColors = colors.filter(([r, g, b]) => {
            const [, s] = this.rgbToHsl(r, g, b);
            return s >= 25;
        });

        const color = filteredColors.length > 0 ? filteredColors[0] : [128, 128, 128];

        this.color = `rgb(${color.join(",")})`;
    }


    /**
     * Converts an RGB color to HSL.
     * @param {number} r Red (0-255)
     * @param {number} g Green (0-255)
     * @param {number} b Blue (0-255)
     * @returns {[number, number, number]} HSL values [hue (0-360), saturation (0-100), lightness (0-100)]
     * @private
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h *= 60;
            s *= 100;
        }
        return [h, s, l];
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
        this.color = item.color;
        this.songIndex = item.songIndex;
    }

    /**
     * @param {Item} item 
     * @returns {boolean}
     */
    compareAll(item) {
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

    /**
     * 
     * @param {Item} item 
     * @returns {boolean}
     */
    compareTrack(item) {
        return (
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album &&
            this.color === item.color
        )
    }
    
}



document.addEventListener("DOMContentLoaded", () => {
    const beef = new BeefWeb(8880);

    beef.init();

    beef.start();
})