const STATUS = {
    online: 1,
    offline: 0,
}

class BeefWeb {

    /**@private */
    status = STATUS.offline

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

    /**@private */
    previousItem = new Item();

    /**@private */
    activeItem = new Item();

    frequency = 500;

    reconnectFrequency = 2000;

    fadeDistance = 1;

    fadeDuration = 2000;

    /**@private */
    worker = new Worker("./script/worker.js");

    /**@private */
    elements = {
        player: new MyElement(),
        data: {
            albumArt: new MyElement(),
            title: new MyElement(),
            artist: new MyElement(),
            album: new MyElement(),
        },
        progress: {
            current: new MyElement(),
            total: new MyElement(),
            bar: new MyElement(),
            container: new MyElement(),
        }
    }

    type = "normal"
    /**@private */
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
        try {
            this.activeItem.update(event.data);
        } catch (event) {
            this.status = STATUS.offline;
        }
        

        if(this.compareAll()){
            console.log("No changes detected");
        } else if(this.compareTrack()){
            console.log("Only time changed");
            this.updateTime();
        } else {
            console.log("Track changed");
            this.updateAll();
        }

        if(this.type == "normal" && this.activeItem.time.current >= this.activeItem.time.total - this.fadeDistance){
            this.fade()
        }

        this.previousItem.from(this.activeItem);
    }

    start(){
        console.log("Starting")
        if(this.status == STATUS.offline) return;
        this.worker.postMessage({
            url: this.root + this.options.player + this.getColumnsQuery(),
            interval: this.frequency
        });
        console.log(this.activeItem)
       
        this.worker.onmessage = this.update.bind(this);
        this.bindAll()
        this.updateAll();
    }

    /**@private */
    bindAll(){
        this.elements.data.title.bind(this.activeItem.columns, "title", "text")
        this.elements.data.artist.bind(this.activeItem.columns, "artist", "text" )
        this.elements.data.album.bind(this.activeItem.columns, "album",  "text")
    }

    async init(){
        
        // await this.loadConfig();
        this.elements.player.setElement(document.getElementById("player"));

        let type = this.elements.player.element.getAttribute("type")
        this.type = type ?? this.type

        console.log(this.type)
        this.elements.data.albumArt.setElement(document.getElementById("playerArt"));
        this.elements.data.title.setElement(document.getElementById("playerTitle"));
        this.elements.data.artist.setElement(document.getElementById("playerArtist"));
        this.elements.data.album.setElement(document.getElementById("playerAlbum"));

        this.elements.progress.current.setElement(document.getElementById("progressCurrent"));
        this.elements.progress.total.setElement(document.getElementById("progressTotal"));
        this.elements.progress.bar.setElement(document.getElementById("progressBar"));

        this.elements.progress.container.setElement(document.getElementById("progressBarContainer"))

        await this.connect()
        if(this.status == STATUS.offline){
            console.log("Attempting to reconnect")
            this.reconnectInterval  = setInterval(async () => {
                await this.connect();
                if(this.status == STATUS.online){
                    clearInterval(this.reconnectInterval)
                    console.log("Back online!")
                    this.start();
                }
            },this.reconnectFrequency)
        }
        if(this.elements.data.albumArt.element){
            this.elements.data.albumArt.element.onerror = () => {
                this.elements.data.albumArt.setAttribute("src", "./assets/unknown.png"); // Set your placeholder image path
            };
        }
     
        if(this.elements.player) this.elements.player.element.addEventListener("animationend", () => this.elements.player.setStyle("animation","none"))
    }

    async loadConfig(){
        const response = await fetch('./config.json');
        const data = await response.json();

        this.frequency = data.frequency;
        this.reconnectFrequency = data.reconnectFrequency;
        this.fadeDistance = data.fadeDistance;
        this.fadeDuration = data.fadeDuration;
    }
    async connect(){
        console.log("Connecting: ", this.activeItem)
        try {
            await this.update({data: await ((await fetch(this.root+this.options.player)).json())});
        } catch (error){
            this.status = STATUS.offline;
            return;
        }
        this.status = STATUS.online
    }
    
    /**@private */
    updateAll(){
       
        this.elements.data.albumArt.setAttribute("src", this.root + this.options.artwork + "?a=" + new Date().getTime());

        if(this.elements.player && this.elements.player.element.style.animation != this.getAnimation()) this.fade()
        this.getCommonColor();
        this.updateTime();
    }

    /**@private */
    updateTime(){
        this.elements.progress.current.setText(this.formatTime(this.activeItem.time.current));
        this.elements.progress.total.setText(this.formatTime(this.activeItem.time.total));
        this.elements.progress.bar.setStyle("width", this.activeItem.time.percent()+"%")

        this.elements.player.setStyle("backgroundColor", this.activeItem.color)
        this.elements.player.setStyle("color", this.activeItem.textColor);
        
        this.elements.progress.container.setStyle("backgroundColor", this.activeItem.allColors[2]);

        this.elements.progress.bar.setStyle("backgroundColor", this.activeItem.textColor)
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
        const img = this.elements.data.albumArt.element;
        if(!img) return
        img.crossOrigin = "anonymous";
        if (img.complete) {
            onLoad(img);
        } else {
            img.addEventListener('load', function() {
                onLoad(img);
            });
        }
    }

    /**@private */
    fade(){
        this.elements.player.setStyle("animation", this.getAnimation());
    }


    getAnimation(){
        switch(this.type){
            case "normal":
                return `fade ${this.fadeDuration}ms`
            case "notification":
                return `fadeInverse ${this.fadeDuration*2}ms`
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
        this.allColors = [];
        this.textColor = "black"
    }


    /**
     * 
     * @param {Array<[number,number,number]>} colors
     */
    setColor(colors){

        const color = colors.length > 0 ? colors[0] : [128, 128, 128];
        this.allColors = colors.map((item) => `rgb(${item.join(",")})`);
        this.color = `rgb(${color.join(",")})`;
        this.textColor = this.allColors[1]
    }


    /**
     * Converts an RGB color to HSL.
     * @param {number} r Red (0-255)
     * @param {number} g Green (0-255)
     * @param {number} b Blue (0-255)
     * @returns {[number, number, number]} HSL values [hue (0-360), saturation (0-100), lightness (0-100)]
     * @private
     * @deprecated
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

        this.time.current = activeItem.position ?? '0:00';
        this.time.total = activeItem.duration ?? '0:00';

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

class MyElement {


    /**
     * @type {?HTMLElement}
     */
    element;

    binds = {}
    /**
     * 
     * @param {HTMLElement} element 
     */
    setElement(element){
        this.element = element;
    }

    /**
     * Binds a variable to an attribute, text, or style property.
     * @param {object} obj - The object containing the property.
     * @param {string} key - The property name to bind.
     * @param {string} type - The type of binding ('attribute', 'text', 'style').
     * @param {string} target - The target attribute/property name.
     * 
     */
    bind(obj, key, type, target) {
        this.binds[key] = obj[key]; // Save original reference

        Object.defineProperty(obj, key, {
            get: () => this.binds[key],
            set: (newValue) => {
                this.binds[key] = newValue;
                if (type === "attribute") {
                    this.setAttribute(target, newValue);
                } else if (type === "text") {
                    this.setText(newValue);
                } else if (type === "style") {
                    this.setStyle(target, newValue);
                }
            },
            configurable: true
        });

        // Initialize the binding with the current value
        if (type === "attribute") {
            this.setAttribute(target, obj[key]);
        } else if (type === "text") {
            this.setText(obj[key]);
        } else if (type === "style") {
            this.setStyle(target, obj[key]);
        }
    }
    /**
     * @param {string} attribute 
     * @param {*} value 
     */
    setAttribute(attribute, value){
        if(this.element) this.element.setAttribute(attribute, value)
    }
    /**
     * @param {*} value 
     */
    setText(value){
        if(this.element) this.element.innerHTML = value;
    }

    /**
     * @param {string} property 
     * @param {*} value 
     */
    setStyle(property, value){
        if(this.element) this.element.style[property] = value;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const beef = new BeefWeb(8880);

    await beef.init();

    beef.start();
})