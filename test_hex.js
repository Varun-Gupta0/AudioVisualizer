const THREE = {
    Vector3: class {
        constructor(x, y, z) {
            this.x = x; this.y = y; this.z = z;
        }
    }
};

const numSpikes = 2000;
const dishRadius = 1.85; 
const baseHeight = 0.08; 

let points = [];
let bestPoints = [];
let minD = 0.01;
let maxD = 0.2;
let d = 0.05;

for (let iter = 0; iter < 40; iter++) {
    d = (minD + maxD) / 2;
    points = [];
    
    const rowHeight = d * Math.sqrt(3) / 2;
    const maxI = Math.ceil(dishRadius / rowHeight);
    
    for (let i = -maxI; i <= maxI; i++) {
        const z = i * rowHeight;
        const xOffset = (Math.abs(i) % 2) * (d / 2);
        const maxJ = Math.ceil(dishRadius / d) + 1;
        
        for (let j = -maxJ; j <= maxJ; j++) {
            const x = j * d + xOffset;
            if (x * x + z * z <= dishRadius * dishRadius) {
                points.push(new THREE.Vector3(x, baseHeight, z));
            }
        }
    }
    
    if (points.length >= numSpikes) {
        bestPoints = [...points]; 
        minD = d; 
    } else {
        maxD = d;
    }
}

points = bestPoints;
points.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));
points = points.slice(0, numSpikes);

console.log("points length:", points.length);
if (points.length > 0) {
    console.log("first point:", points[0]);
    console.log("last point:", points[points.length-1]);
} else {
    console.log("ARRAY IS EMPTY! bestPoints length:", bestPoints.length);
}
