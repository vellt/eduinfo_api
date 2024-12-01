// Nap visszaadó metódus
function getDay(dateString) {
    const date = new Date(dateString);
    return date.getDate(); // Visszaadja a nap számát
}

// Hónap szöveges formában visszaadó metódus
function getMonthAsText(dateString) {
    const date = new Date(dateString);

    // Hónap rövidítések
    const monthNames = [
        'jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 
        'júl', 'aug', 'szept', 'okt', 'nov', 'dec'
    ];

    return monthNames[date.getMonth()]; // Visszaadja a hónapot szöveges formában
}

function getFormatTime(startDateString, endDateString) {
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);
    
    const options = { hour: '2-digit', minute: '2-digit' };
    const startTime = startDate.toLocaleTimeString('hu-HU', options).replace(':', ':'); // "18:00"
    const endTime = endDate.toLocaleTimeString('hu-HU', options).replace(':', ':'); // "19:30"
    
    return `${startTime}-${endTime}`;
}


/*
Ha az általad visszaadott JSON-ban a formatted_datetime mezők formátuma a kívánttól eltér, és szeretnéd, hogy az adott időpontok helyett a megjelenített formátumok a különböző dátumokhoz alkalmazkodjanak, érdemes lehet frissíteni a dynamicsDateTime metódust, hogy minden időponthoz a helyes formátumot rendelje.
Kívánt Dátum- és Időformátum

A kívánt formátum:

    Ha több mint egy év van eltérés: YYYY. MM. DD (például: 2022. 10. 20)
    Ha egy éven belül: MMM DD (például: nov. 22)
    Ha egy héten belül: Hétfő (például: Hétfő)
    Ha mai nap: HH:mm (például: 16:20)
*/
function dynamicsDateTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffTime = now - date; // Különbség milliszekundumban
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Különbség napokban

    // Kerekítjük a napokat, hogy ne legyen probléma a pontos idővel
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.getDate() === today.getDate()) {
        // Ha a dátum ma van
        return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        // Ha egy héten belül (de nem tegnap)
        return date.toLocaleDateString('hu-HU', { weekday: 'long' }); // Nap neve
    } else if (date.getFullYear() === today.getFullYear()) {
        // Ha egy éven belül
        return date.toLocaleDateString('hu-HU', {
            month: 'short',
            day: 'numeric'
        }).replace('.', '.'); // Formátum: nov. 22
    } else {
        // Minden más esetben teljes dátum
        return date.toLocaleDateString('hu-HU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/(\d+)\.(\d+)\.(\d+)/, '$1. $2. $3'); // Formázás YYYY. MM. DD
    }
}



module.exports = { getDay, getMonthAsText, getFormatTime, dynamicsDateTime};