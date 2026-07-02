const audio = document.getElementById('audio');
const progressBar = document.querySelector('.progress-bar');
const progressContainer = document.querySelector('.progress');
const currentTimeDisplay = document.querySelector('.current-time');
const totalTimeDisplay = document.querySelector('.total-time');

// Tugmalarning o'zini tanlab olamiz (faqat ikonkani emas)
const playPauseBtn = document.querySelector('.play-pause');
const prevBtn = document.querySelector('.prev');
const nextBtn = document.querySelector('.next');
const shuffleBtn = document.querySelector('.shuffle');
const repeatBtn = document.querySelector('.repeat');
const favoriteBtn = document.querySelector('.favorite-container');
const connectBtn = document.querySelector('.connect');
const fileInput = document.getElementById('local-file-input');

const songTitleDisplay = document.getElementById('song-title');
const artistNameDisplay = document.getElementById('artist-name');
const volumeSlider = document.querySelector('.volume-slider');
const volumeIcon = document.querySelector('.volume-icon');

// Pleylist ob'ekt ko'rinishiga keltirildi (Nomi chiroyli chiqishi uchun)
let playlist = [
    { src: './audio/lost-in-dreams-abstract-chill-downtempo-cinematic-future-beats-270241.mp3', title: 'Lost in Dreams', artist: 'Abstract Chill' },
    { src: './audio/nightfall-future-bass-music-228100.mp3', title: 'Nightfall', artist: 'Future Bass' },
    { src: './audio/showreel-music-promo-advertising-opener-vlog-background-intro-theme-261601.mp3', title: 'Showreel Music', artist: 'Vlog Opener' },
    { src: './audio/spinning-head-271171.mp3', title: 'Spinning Head', artist: 'Electronic' },
    { src: './audio/stylish-deep-electronic-262632.mp3', title: 'Stylish Deep', artist: 'Deep Electronic' },
    { src: './audio/vlog-music-beat-trailer-showreel-promo-background-intro-theme-274290.mp3', title: 'Vlog Music Beat', artist: 'Background Intro' }
];

let currentSongIndex = 0;
let isPlaying = false;
let isShuffleActive = false;
let isRepeatActive = false;

// Musiqani yuklash va ijro etish funksiyasi
function loadMusic(index, autoPlay = true) {
    if (playlist.length === 0) return;
    
    audio.src = playlist[index].src;
    audio.load();
    updatePlayerInfo();

    if (autoPlay) {
        audio.play().then(() => {
            isPlaying = true;
            updatePlayPauseIcon();
        }).catch(err => console.log("Ijro bloklandi yoki yuklanmadi:", err));
    } else {
        isPlaying = false;
        updatePlayPauseIcon();
    }
}

function updatePlayPauseIcon() {
    const icon = playPauseBtn.querySelector('i');
    if (isPlaying) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

function togglePlayPause() {
    if (playlist.length === 0) return;
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play().catch(err => console.log(err));
    }
    isPlaying = !isPlaying;
    updatePlayPauseIcon();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateProgressBar() {
    const currentTime = audio.currentTime;
    const duration = audio.duration;
    if (duration) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
        currentTimeDisplay.textContent = formatTime(currentTime);
    }
}

function setProgressBar(e) {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    if (duration) {
        audio.currentTime = (clickX / width) * duration;
    }
}

function toggleShuffle() {
    isShuffleActive = !isShuffleActive;
    shuffleBtn.classList.toggle('active', isShuffleActive);
}

function toggleRepeat() {
    isRepeatActive = !isRepeatActive;
    repeatBtn.classList.toggle('active', isRepeatActive);
}

function setFavorite() {
    const icon = favoriteBtn.querySelector('i');
    icon.classList.toggle('fas');
    icon.classList.toggle('fa-regular');
}

function updatePlayerInfo() {
    if (playlist.length === 0) return;
    const currentSong = playlist[currentSongIndex];
    songTitleDisplay.textContent = currentSong.title;
    artistNameDisplay.textContent = currentSong.artist || "Noma'lum artist";
}

function playNextSong() {
    if (playlist.length === 0) return;
    
    if (isShuffleActive) {
        // Haqiqiy tasodifiy musiqa tanlash qismi
        currentSongIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
    }
    loadMusic(currentSongIndex, true);
}

function playPrevSong() {
    if (playlist.length === 0) return;
    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    loadMusic(currentSongIndex, true);
}

function updateVolumeIcon() {
    volumeIcon.className = 'fas volume-icon ';
    if (audio.volume === 0) {
        volumeIcon.classList.add('fa-volume-mute');
    } else if (audio.volume < 0.5) {
        volumeIcon.classList.add('fa-volume-down');
    } else {
        volumeIcon.classList.add('fa-volume-up');
    }
}

// QIZIL BELGI: Qurilmadan fayl yuklash hodisasi
connectBtn.addEventListener('click', () => {
    fileInput.click(); // Yashirin inputni faollashtiradi
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        const startIndex = playlist.length; // Yangi qo'shilgan joy boshlanishi
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const blobUrl = URL.createObjectURL(file); // Lokal manzil yaratish
            const cleanTitle = file.name.replace(/\.[^/.]+$/, ""); // Formatni o'chirish (.mp3 ni)
            
            playlist.push({
                src: blobUrl,
                title: cleanTitle,
                artist: 'Qurilmadagi fayl'
            });
        }
        
        // Birinchi yuklangan yangi musiqaga o'tish va darhol ijro etish
        currentSongIndex = startIndex;
        loadMusic(currentSongIndex, true);
    }
});

// Hodisalarni eshituvchilar (Event Listeners)
audio.addEventListener('loadedmetadata', () => {
    if (audio.duration) {
         totalTimeDisplay.textContent = formatTime(audio.duration);
    }
    updateVolumeIcon();
});

playPauseBtn.addEventListener('click', togglePlayPause);
audio.addEventListener('timeupdate', updateProgressBar);
progressContainer.addEventListener('click', setProgressBar);

audio.addEventListener('ended', () => {
    if (isRepeatActive) {
        audio.currentTime = 0;
        audio.play().catch(err => console.log(err));
    } else {
         playNextSong();
    }
});

shuffleBtn.addEventListener('click', toggleShuffle);
repeatBtn.addEventListener('click', toggleRepeat);
favoriteBtn.addEventListener('click', setFavorite);
prevBtn.addEventListener('click', playPrevSong);
nextBtn.addEventListener('click', playNextSong);

volumeSlider.addEventListener('input', function() {
    audio.volume = parseFloat(this.value);
    updateVolumeIcon();
});

// Ilk ishga tushirish (Avtomatik ijrosiz ishga tushadi, brauzer xatolik bermasligi uchun)
audio.volume = parseFloat(volumeSlider.value);
loadMusic(currentSongIndex, false);