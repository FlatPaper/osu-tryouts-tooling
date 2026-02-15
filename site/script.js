let rawData = null;
let selectedPlayers = new Set();
let selectedMaps = new Set();

const dataFile = window.DATA_FILE || "../data-tools/data/osu_scores_low_sr.json";

fetch(`../data-tools/data/${dataFile}`)
    .then(res => res.json())
    .then(data => {
        rawData = data;
        init();
    });


function getSlotOrder(slot) {
    if (slot.startsWith("NM")) return 1;
    if (slot.startsWith("HD")) return 2;
    if (slot.startsWith("HR")) return 3;
    if (slot.startsWith("DT")) return 4;
    if (slot.startsWith("FM")) return 5;
    if (slot.startsWith("AIM")) return 6;
    if (slot.startsWith("TAP")) return 7;
    if (slot.startsWith("GMC")) return 8;
    if (slot.startsWith("CTL")) return 9;
    if (slot.startsWith("TB")) return 10;
    return 99;
}

function init() {
    const slider = document.getElementById("dropSlider");
    const label = document.getElementById("dropValue");

    label.textContent = slider.value;

    slider.addEventListener("input", () => {
        label.textContent = slider.value;
        renderDashboard(parseInt(slider.value));
    });

    generatePlayerSelector();
    generateMapSelector();
    renderDashboard(0);
}

function generatePlayerSelector() {

    const container = document.getElementById("player-selector");
    const users = rawData.users;

    const playerList = Object.values(users)
        .sort((a, b) => a.username.localeCompare(b.username));

    container.innerHTML = playerList.map(user => `
        <label>
            <input type="checkbox" value="${user.user_id}" checked />
            ${user.username}
        </label>
    `).join("");

    // Default: all selected
    selectedPlayers.clear();
    playerList.forEach(user => {
        selectedPlayers.add(user.user_id);
    });

    // Checkbox listeners
    container.querySelectorAll("input").forEach(cb => {
        cb.addEventListener("change", () => {
            const id = parseInt(cb.value);

            if (cb.checked) {
                selectedPlayers.add(id);
            } else {
                selectedPlayers.delete(id);
            }

            renderDashboard(parseInt(document.getElementById("dropSlider").value));
        });
    });

    /* =========================
       Select / Clear Buttons
       ========================= */

    const selectAllBtn = document.getElementById("select-all");
    const clearAllBtn = document.getElementById("clear-all");

    selectAllBtn.addEventListener("click", () => {
        selectedPlayers.clear();

        container.querySelectorAll("input").forEach(cb => {
            cb.checked = true;
            selectedPlayers.add(parseInt(cb.value));
        });

        renderDashboard(parseInt(document.getElementById("dropSlider").value));
    });

    clearAllBtn.addEventListener("click", () => {
        selectedPlayers.clear();

        container.querySelectorAll("input").forEach(cb => {
            cb.checked = false;
        });

        renderDashboard(parseInt(document.getElementById("dropSlider").value));
    });
}



function renderDashboard(dropCount) {

    const mapsRow = document.getElementById("maps-row");
    const droppedRow = document.getElementById("dropped-row");
    const avgSection = document.getElementById("average-section");
    const customSection = document.getElementById("custom-leaderboard");
    customSection.innerHTML = "";


    mapsRow.innerHTML = "";
    droppedRow.innerHTML = "";
    avgSection.innerHTML = "";

    const users = rawData.users;
    const players = rawData.players;

    const maps = Object.values(rawData.maps).sort((a, b) => {
        const groupDiff = getSlotOrder(a.slot) - getSlotOrder(b.slot);
        if (groupDiff !== 0) return groupDiff;
        return a.slot.localeCompare(b.slot, undefined, {numeric: true});
    });

    /* ---------------- Determine dropped scores ---------------- */

    const dropped = new Set();

    for (const userId in players) {
        if (!selectedPlayers.has(parseInt(userId))) continue;
        const sorted = [...players[userId].scores]
            .sort((a, b) => a.score - b.score);

        sorted.slice(0, dropCount).forEach(s => {
            dropped.add(`${userId}:${s.beatmap_id}`);
        });
    }

    /* =========================
       ROW 1 — ACTIVE MAP TABLES
       ========================= */

    for (const map of maps) {

        const mapScores = [];

        for (const userId in players) {
            if (!selectedPlayers.has(parseInt(userId))) continue;
            const score = players[userId].scores.find(
                s => s.beatmap_id === map.beatmap_id
            );
            if (!score) continue;

            if (dropped.has(`${userId}:${map.beatmap_id}`)) continue;

            mapScores.push({
                username: users[userId]?.username ?? "Unknown",
                score: score.score,
                accuracy: score.accuracy
            });
        }

        mapScores.sort((a, b) => b.score - a.score);

        const wrapper = document.createElement("div");
        wrapper.className = "map-table";

        wrapper.innerHTML = `
          <h3>${map.slot}</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Acc</th>
              </tr>
            </thead>
            <tbody>
              ${mapScores.length
                    ? mapScores.map((entry, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td>${entry.username}</td>
                      <td>${entry.score.toLocaleString()}</td>
                      <td>${entry.accuracy.toFixed(2)}%</td>
                    </tr>
                  `).join("")
                    : `<tr><td colspan="4">—</td></tr>`
                }
            </tbody>
          </table>
        `;

        mapsRow.appendChild(wrapper);
    }

    /* =========================
       ROW 2 — DROPPED MAP TABLES
       ========================= */

    for (const map of maps) {

        const droppedScores = [];

        for (const userId in players) {
            if (!selectedPlayers.has(parseInt(userId))) continue;
            const score = players[userId].scores.find(
                s => s.beatmap_id === map.beatmap_id
            );
            if (!score) continue;

            if (!dropped.has(`${userId}:${map.beatmap_id}`)) continue;

            droppedScores.push({
                username: users[userId]?.username ?? "Unknown",
                score: score.score,
                accuracy: score.accuracy
            });
        }

        droppedScores.sort((a, b) => b.score - a.score);

        const wrapper = document.createElement("div");
        wrapper.className = "dropped-table";

        wrapper.innerHTML = `
      <h3>${map.slot}</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Score</th>
            <th>Acc</th>
          </tr>
        </thead>
        <tbody>
          ${droppedScores.length
            ? droppedScores.map((entry, i) => `
                <tr class="dropped-highlight">
                  <td>${i + 1}</td>
                  <td>${entry.username}</td>
                  <td>${entry.score.toLocaleString()}</td>
                  <td>${entry.accuracy.toFixed(2)}%</td>
                </tr>
              `).join("")
            : `<tr><td colspan="4">—</td></tr>`
        }
        </tbody>
      </table>
    `;

        droppedRow.appendChild(wrapper);
    }

    /* =========================
       ROW 3 — AVERAGE TABLE
       ========================= */

    // Compute placements per map (after drop filtering)
    const placementByPlayer = {};

    for (const map of maps) {

        const ranking = [];

        for (const userId in players) {
            if (!selectedPlayers.has(parseInt(userId))) continue;

            const score = players[userId].scores.find(
                s => s.beatmap_id === map.beatmap_id
            );

            if (!score) continue;
            if (dropped.has(`${userId}:${map.beatmap_id}`)) continue;

            ranking.push({
                userId,
                score: score.score
            });
        }

        ranking.sort((a, b) => b.score - a.score);

        ranking.forEach((entry, index) => {
            if (!placementByPlayer[entry.userId]) {
                placementByPlayer[entry.userId] = [];
            }
            placementByPlayer[entry.userId].push(index + 1);
        });
    }


    const averages = [];

    for (const userId in players) {
        if (!selectedPlayers.has(parseInt(userId))) continue;

        const skipped = [];
        const kept = [];
        const keptScores = [];

        players[userId].scores.forEach(score => {
            const key = `${userId}:${score.beatmap_id}`;
            const map = maps.find(m => m.beatmap_id === score.beatmap_id);
            if (!map) return;

            if (dropped.has(key)) {
                skipped.push(map.slot);
            } else {
                kept.push(map.slot);
                keptScores.push(score);
            }
        });

        if (!keptScores.length) continue;

        const avgScore =
            keptScores.reduce((sum, s) => sum + s.score, 0) /
            keptScores.length;

        const avgAcc =
            keptScores.reduce((sum, s) => sum + s.accuracy, 0) /
            keptScores.length;

        const placements = placementByPlayer[userId] || [];

        const avgPlacement = placements.length
            ? placements.reduce((a, b) => a + b, 0) / placements.length
            : null;

        averages.push({
            username: users[userId]?.username ?? "Unknown",
            avgScore,
            avgAcc,
            avgPlacement,
            skipped,
            kept
        });

    }

    averages.sort((a, b) => {
        if (a.avgPlacement == null) return 1;
        if (b.avgPlacement == null) return -1;
        return a.avgPlacement - b.avgPlacement; // lower = better
    });



    avgSection.innerHTML = `
      <h2>Average Results</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Average Placement</th>
            <th>Average Score</th>
            <th>Average Acc</th>
            <th>Skipped Maps</th>
            <th>Kept Maps</th>
          </tr>
        </thead>
        <tbody>
          ${averages.map((entry, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${entry.username}</td>
              <td>${entry.avgPlacement?.toFixed(2) ?? "—"}</td>
              <td>${Math.round(entry.avgScore).toLocaleString()}</td>
              <td>${entry.avgAcc.toFixed(2)}%</td>
              <td>${entry.skipped.length ? entry.skipped.join(", ") : "—"}</td>
              <td>${entry.kept.length ? entry.kept.join(", ") : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    /* =========================
   ROW 4 — CUSTOM LEADERBOARD
   ========================= */

    if (selectedMaps.size > 0) {

        const customResults = [];

        for (const userId in players) {
            if (!selectedPlayers.has(parseInt(userId))) continue;

            const scores = players[userId].scores
                .filter(s => selectedMaps.has(s.beatmap_id));

            if (!scores.length) continue;

            const avgScore =
                scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

            const avgAcc =
                scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length;

            customResults.push({
                username: users[userId]?.username ?? "Unknown",
                avgScore,
                avgAcc,
                mapsPlayed: scores.length
            });
        }

        customResults.sort((a, b) => b.avgScore - a.avgScore);

        customSection.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Average Score</th>
                    <th>Average Acc</th>
                    <th>Maps Used</th>
                </tr>
            </thead>
            <tbody>
                ${customResults.map((entry, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${entry.username}</td>
                        <td>${Math.round(entry.avgScore).toLocaleString()}</td>
                        <td>${entry.avgAcc.toFixed(2)}%</td>
                        <td>${entry.mapsPlayed}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
    }


}

function generateMapSelector() {

    const container = document.getElementById("map-selector");

    const maps = Object.values(rawData.maps)
        .sort((a, b) => {
            const groupDiff = getSlotOrder(a.slot) - getSlotOrder(b.slot);
            if (groupDiff !== 0) return groupDiff;
            return a.slot.localeCompare(b.slot, undefined, { numeric: true });
        });


    container.innerHTML = maps.map(map => `
        <label>
            <input type="checkbox" value="${map.beatmap_id}" />
            ${map.slot}
        </label>
    `).join("");

    container.querySelectorAll("input").forEach(cb => {
        cb.addEventListener("change", () => {
            const id = parseInt(cb.value);
            if (cb.checked) {
                selectedMaps.add(id);
            } else {
                selectedMaps.delete(id);
            }

            renderDashboard(parseInt(document.getElementById("dropSlider").value));
        });
    });
}


