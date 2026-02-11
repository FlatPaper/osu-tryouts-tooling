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
    const avgSection = document.getElementById("average-section");

    mapsRow.innerHTML = "";
    avgSection.innerHTML = "";

    const users = rawData.users;
    const players = rawData.players;

    const maps = Object.values(rawData.maps).sort((a, b) => {
        const groupDiff = getSlotOrder(a.slot) - getSlotOrder(b.slot);
        if (groupDiff !== 0) return groupDiff;
        return a.slot.localeCompare(b.slot, undefined, { numeric: true });
    });

    /* ---------------- Determine dropped scores ---------------- */

    const dropped = new Set();

    for (const userId in players) {
        const sorted = [...players[userId].scores].sort((a, b) => a.score - b.score);
        sorted.slice(0, dropCount).forEach(s => {
            dropped.add(`${userId}:${s.beatmap_id}`);
        });
    }

    /* ---------------- Render map tables ---------------- */

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
                score: score.score
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
          </tr>
        </thead>
        <tbody>
          ${mapScores.map((entry, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${entry.username}</td>
              <td>${entry.score.toLocaleString()}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

        mapsRow.appendChild(wrapper);
    }

    /* ---------------- Render average table ---------------- */

    const averages = [];

    for (const userId in players) {
        const validScores = players[userId].scores.filter(
            s => !dropped.has(`${userId}:${s.beatmap_id}`)
        );

        if (validScores.length === 0) continue;

        const avg =
            validScores.reduce((sum, s) => sum + s.score, 0) /
            validScores.length;

        averages.push({
            username: users[userId]?.username ?? "Unknown",
            average: avg
        });
    }

    averages.sort((a, b) => b.average - a.average);

    avgSection.className = "average-section";
    avgSection.innerHTML = `
    <h2>Average Scores</h2>
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>Average Score</th>
        </tr>
      </thead>
      <tbody>
        ${averages.map(entry => `
          <tr>
            <td>${entry.username}</td>
            <td>${Math.round(entry.average).toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
