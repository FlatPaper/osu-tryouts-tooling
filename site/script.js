let rawData = null;

fetch("../data-tools/data/osu_scores.json")
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
    if (slot.startsWith("TB")) return 6;
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

    renderDashboard(0);
}

function renderDashboard(dropCount) {

    const mapsRow = document.getElementById("maps-row");
    const droppedRow = document.getElementById("dropped-row");
    const avgSection = document.getElementById("average-section");

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

    const averages = [];

    for (const userId in players) {

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

        averages.push({
            username: users[userId]?.username ?? "Unknown",
            avgScore,
            avgAcc,
            skipped,
            kept
        });
    }

    averages.sort((a, b) => b.avgScore - a.avgScore);


    avgSection.innerHTML = `
      <h2>Average Results</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
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
              <td>${Math.round(entry.avgScore).toLocaleString()}</td>
              <td>${entry.avgAcc.toFixed(2)}%</td>
              <td>${entry.skipped.length ? entry.skipped.join(", ") : "—"}</td>
              <td>${entry.kept.length ? entry.kept.join(", ") : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

}


