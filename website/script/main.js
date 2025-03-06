
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

    /**
     * @type {?Item}
     */
    activeItem = null;

    frequency = 1000;
    constructor(port){
        this.port = port
        this.root = "http://localhost:" + port + "/api"
    }

    async getItem(){
        const path = this.options.player + this.getColumnsQuery();
        console.log(path)
        const response = await this.fetch(path)
        return new Item(response)
    }

    async fetch(path){
        return (await fetch(this.root + path)).json();
    }

    getColumnsQuery(){
        return "?columns="+this.columns.join(",");
    }

    async update(){
        this.activeItem = await this.getItem();
        console.log(this.activeItem.time.percent())
    }

    start(){
        this.interval = setInterval(() => this.update(), this.frequency);
    }
    
}

class Item {
    
    constructor(data){
        let activeItem = data.player.activeItem;
        this.playlist = {
            id: activeItem.playlistId,
            index: activeItem.playlistIndex
        }

        this.songIndex = activeItem.index;

        this.time = {
            current: activeItem.duration,
            total: activeItem.position,
            percent: () => {
                return (this.time.total / this.time.current)*100;
            }
        }

        this.columns = {
            isPlaying: activeItem.columns[0],
            isPaused: activeItem.columns[1],
            albumArtist: activeItem.columns[2],
            album: activeItem.columns[3],
            artist: activeItem.columns[4],
            title: activeItem.columns[5],
            trackNumber: activeItem.columns[6],
            length: activeItem.columns[7],
            elapsed: activeItem.columns[8],
            path: activeItem.columns[9]
        }
    }
}


async function main(){
    const beef = new BeefWeb(8880);

    beef.start();
}

main();