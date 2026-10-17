// Small painted miniatures: warm upper planes, cool undersides and articulated
// limbs. Geometry is reused across frames and world copies.
export function createShoreAnimalRendering() {
  const paths = {
    body: new Path2D(
      "M-12-12 C-13-17-7-17-3-16 C1-16 4-17 7-16 C11-15 12-10 8-7 C5-6 1-8-3-7 C-7-6-12-7-12-12Z",
    ),
    belly: new Path2D("M-11-11 C-6-8 2-11 10-11 C10-8 8-6 5-7 C0-9-6-5-10-8Z"),
    shoulder: new Path2D("M5-15 C9-15 10-11 7-8 C5-9 4-12 5-15Z"),
    haunch: new Path2D("M-10-15 C-5-17-3-12-6-8 C-9-7-13-11-10-15Z"),
    deerNeck: new Path2D("M-3 2 C0-3 2-9 4-14 L7-15 C7-9 5-3 3 1Z"),
    horseNeck: new Path2D(
      "M-4 2 C0-2-1-10 3-15 C5-18 8-16 9-13 L8-9 C5-8 5-2 4 2Z",
    ),
    deerHead: new Path2D(
      "M4-15 C4-18 8-19 10-16 L15-13 Q16-11 13-11 L8-12 Q5-12 4-15Z",
    ),
    horseHead: new Path2D(
      "M5-16 C7-19 11-17 11-14 L15-9 Q15-6 12-7 L8-11 Q4-12 5-16Z",
    ),
    deerEars: new Path2D(
      "M5-16 Q0-17 0-22 Q5-22 6-17 M8-17 Q8-23 12-22 Q13-19 8-17",
    ),
    horseEars: new Path2D("M5-16 L4-22 Q7-23 7-17 M8-17 L9-22 Q11-22 10-16"),
    mane: new Path2D("M-3-1 C-1-5-2-13 2-16 Q5-19 7-17 C1-16 2-9 0-5 L-2-2Z"),
    antlers: new Path2D(
      "M5-18 Q1-22 2-27 M2-24 L-1-26 M2-25 L5-28 M8-18 Q10-22 9-28 M10-24 L13-27 M9-25 L7-27",
    ),
    horseTail: new Path2D(
      "M-11-14 Q-17-15-17-8 Q-17-3-20-1 Q-14-2-14-7 Q-13-11-10-11Z",
    ),
    deerTail: new Path2D("M-11-12 Q-15-12-15-10 Q-13-9-11-10Z"),
    goatBody: new Path2D(
      "M-12-12 C-13-18-7-18-2-17 L6-17 Q12-15 9-8 L5-6 Q0-9-5-7 L-9-6Z",
    ),
    goatNeck: new Path2D("M-4 2 Q-1-5 1-10 L5-11 Q6-5 4 2Z"),
    goatHead: new Path2D("M1-11 Q4-15 8-12 L13-8 Q14-6 11-6 L6-8 Q2-7 1-11Z"),
    goatEars: new Path2D(
      "M3-10 Q-3-10-4-14 Q0-15 5-11 M6-12 Q10-17 13-14 L8-11",
    ),
    goatHorns: new Path2D(
      "M3-13 Q-1-23-6-20 Q-2-20 1-13 M6-13 Q3-23-2-23 Q2-21 4-12",
    ),
    goatBeard: new Path2D("M6-8 L9-7 L7-2 L6-4 L4-2Z"),
    goatTail: new Path2D("M-11-12 Q-17-15-15-18 Q-12-17-10-13Z"),
    boarBody: new Path2D(
      "M-13-11 C-15-19-9-22-3-21 C4-23 11-18 12-13 L12-9 Q6-7 0-7 Q-9-5-13-11Z",
    ),
    boarNeck: new Path2D("M-5-7 Q0-13 6-9 L9-3 Q3 1-3 1Z"),
    boarHead: new Path2D("M0-9 Q5-12 9-6 L17-3 L17 0 L10 1 Q6-1 2-2Z"),
    boarEars: new Path2D("M1-7 L-1-12 Q4-13 6-9 M6-8 L9-12 Q12-11 10-7"),
    boarTusk: new Path2D("M11-1 Q10-3 11-5 Q8-3 9 0Z"),
    boarTail: new Path2D("M-12-12 Q-17-14-17-11 Q-17-8-19-8"),
    boarBristles: new Path2D(
      "M-9-20 L-8-21 L-7-20.5 L-5-22 L-4-21 L-2-22.5 L0-21 L2-22 L3-20.5 L5-21 L8-18",
    ),
    foxBody: new Path2D(
      "M-13-12 Q-11-17-5-16 Q1-16 6-16 Q11-16 11-11 L7-8 Q2-10-3-9 Q-11-7-13-12Z",
    ),
    foxNeck: new Path2D("M-4 1 L-3-7 L2-10 L7-6 L7-1 L2 2Z"),
    foxHead: new Path2D("M0-9 L5-12 L9-8 L16-5 Q17-4 14-3 L8-3 L4-1 L0-4Z"),
    foxEars: new Path2D("M0-7 L1-14 L6-11 M6-9 L9-14 L11-7"),
    foxTail: new Path2D("M-11-14 C-19-18-20-5-30-6 C-28 0-18-1-13-7 L-10-10Z"),
    foxTailTip: new Path2D("M-23-7 Q-26-5-30-6 Q-28-1-23-2 L-21-4Z"),
    foxBib: new Path2D("M1-8 L5-5 L9-4 L5 2 L1 3 L-1-2Z"),
  };
  const profiles = {
    deer: {
      body: paths.body,
      neck: paths.deerNeck,
      head: paths.deerHead,
      ears: paths.deerEars,
      tail: paths.deerTail,
      bodyY: -5,
      hipY: -15,
      neckY: -13,
      headX: 0.8,
      headY: 0.64,
      graze: 1.45,
      muzzle: [14, -12],
      eye: [8.5, -15.2],
      coat: 0,
      colors: 3,
    },
    horse: {
      body: paths.body,
      neck: paths.horseNeck,
      head: paths.horseHead,
      ears: paths.horseEars,
      tail: paths.horseTail,
      bodyY: -5,
      hipY: -15,
      neckY: -13,
      headX: 0.8,
      headY: 0.64,
      graze: 1.45,
      muzzle: [13.5, -8],
      eye: [8.5, -15.2],
      coat: 0,
      colors: 3,
    },
    goat: {
      body: paths.goatBody,
      neck: paths.goatNeck,
      head: paths.goatHead,
      ears: paths.goatEars,
      tail: paths.goatTail,
      bodyY: -2,
      hipY: -12,
      neckY: -14,
      headX: 0.85,
      headY: 0.8,
      graze: 1.2,
      muzzle: [12, -7],
      eye: [7, -10.5],
      coat: 3,
      colors: 2,
    },
    boar: {
      body: paths.boarBody,
      neck: paths.boarNeck,
      head: paths.boarHead,
      ears: paths.boarEars,
      tail: paths.boarTail,
      bodyY: 3,
      hipY: -7,
      neckY: -10,
      headX: 0.85,
      headY: 0.85,
      graze: 0.32,
      muzzle: [16, -1.5],
      eye: [7, -6],
      coat: 5,
      colors: 2,
    },
    fox: {
      body: paths.foxBody,
      neck: paths.foxNeck,
      head: paths.foxHead,
      ears: paths.foxEars,
      tail: paths.foxTail,
      bodyY: 3,
      hipY: -7,
      neckY: -13,
      headX: 0.7,
      headY: 0.7,
      graze: 0.65,
      muzzle: [15, -4],
      eye: [7, -7],
      coat: 7,
      colors: 2,
    },
  };
  const coats = [
    ["#c5a476", "#9e7950", "#74543b", "#4c4135", "#d3bd96"],
    ["#ae9578", "#897058", "#625344", "#3e3b34", "#cbbda3"],
    ["#a98563", "#826044", "#5c4636", "#39352f", "#c1a780"],
    ["#d4c9aa", "#aca18b", "#7e7767", "#49483f", "#e1d6bb"],
    ["#b4b3a5", "#8b8b7e", "#62685e", "#3f463f", "#d3d1be"],
    ["#918372", "#706150", "#4e493f", "#353930", "#d3c5a3"],
    ["#7f8073", "#656658", "#474b40", "#30372e", "#c6bda0"],
    ["#c8a06b", "#ad7846", "#7d5738", "#464036", "#decdb0"],
    ["#bb936a", "#996d49", "#71513b", "#403c34", "#d4c5a8"],
  ].map(([light, mid, shade, dark, cream]) => ({
    light,
    mid,
    shade,
    dark,
    cream,
  }));

  function coatGradient(c, coat, top, bottom) {
    // Canvas gradients capture the current transform. Create them in the
    // figure's local frame so shading follows its position and head rotation.
    const gradient = c.createLinearGradient(-5, top, 4, bottom);
    gradient.addColorStop(0, coat.light);
    gradient.addColorStop(0.38, coat.mid);
    gradient.addColorStop(1, coat.shade);
    return gradient;
  }

  function leg(c, motion, hip, far, rear, pose, coat, hipY) {
    hip -= far ? 1.6 : 0;
    const ground = far ? -1.1 : 0;
    const footX = hip + motion.swing;
    const footY = ground - motion.lift;
    const jointX = hip + motion.swing * 0.45 + (rear ? -1.3 : 0.8);
    const jointY = hipY * 0.47 + pose.bob * 0.4;
    c.fillStyle = far ? coat.dark : coat.shade;
    c.beginPath();
    c.moveTo(hip - 1.3, hipY + pose.bob);
    c.quadraticCurveTo(hip - 1.4, hipY * 0.73, jointX - 0.55, jointY);
    c.lineTo(footX - 0.4, footY);
    c.lineTo(footX + 0.6, footY);
    c.lineTo(jointX + 0.65, jointY);
    c.quadraticCurveTo(hip + 2, hipY * 0.73, hip + 1.5, hipY + pose.bob);
    c.closePath();
    c.fill();
    c.fillStyle = coat.dark;
    c.beginPath();
    c.moveTo(footX - 0.5, footY - 0.9);
    c.lineTo(footX + 0.7, footY - 0.8);
    c.lineTo(footX + 1.2, footY + 0.25);
    c.lineTo(footX - 0.6, footY + 0.25);
    c.closePath();
    c.fill();
  }

  return function drawShoreAnimal(
    c,
    pose,
    { species = "deer", antlers = false, variant = 0, detail = true } = {},
  ) {
    const profile = profiles[species] || profiles.deer;
    const horse = species === "horse";
    const fox = species === "fox";
    const boar = species === "boar";
    const goat = species === "goat";
    const coat = coats[profile.coat + (variant % profile.colors)];
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";

    // The broad cast shadow and darker hoof contact anchor the figure to land.
    c.fillStyle = "rgba(43,41,28,.10)";
    c.beginPath();
    c.ellipse(2, 0.8, 16, 3.1, -0.06, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(43,38,26,.14)";
    c.beginPath();
    c.ellipse(0, 0, 10, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    leg(c, pose.legs[0], -8, true, true, pose, coat, profile.hipY);
    leg(c, pose.legs[1], 6, true, false, pose, coat, profile.hipY);

    c.save();
    c.translate(0, profile.bodyY + pose.bob + pose.breath);
    c.save();
    c.translate(-11, -13);
    c.rotate(pose.tail);
    c.translate(11, 13);
    c.fillStyle = horse ? coat.dark : fox ? coat.mid : coat.cream;
    if (boar) {
      c.strokeStyle = coat.dark;
      c.lineWidth = 0.7;
      c.stroke(profile.tail);
    } else c.fill(profile.tail);
    if (fox) {
      c.fillStyle = coat.cream;
      c.fill(paths.foxTailTip);
    }
    c.restore();

    c.fillStyle = coatGradient(c, coat, -18, -5);
    c.fill(profile.body);
    if (boar) {
      c.fillStyle = coat.shade;
      c.fill(paths.boarBristles);
    }
    c.fillStyle = coat.shade;
    c.globalAlpha *= 0.22;
    c.fill(paths.belly);
    c.restore();

    leg(c, pose.legs[2], -8, false, true, pose, coat, profile.hipY);
    leg(c, pose.legs[3], 6, false, false, pose, coat, profile.hipY);
    c.save();
    c.translate(0, profile.bodyY + pose.bob + pose.breath);
    if (detail) {
      c.save();
      c.globalAlpha *= 0.2;
      c.fillStyle = coat.light;
      c.fill(paths.haunch);
      c.fill(paths.shoulder);
      c.restore();
      c.strokeStyle = coat.light;
      c.lineWidth = 0.45;
      c.beginPath();
      c.moveTo(-10, -15);
      c.bezierCurveTo(-5, -16.5, 2, -15, 6, -16);
      c.stroke();
    }

    // Head and neck pivot together while browsing; the torso stays balanced.
    c.translate(7, profile.neckY);
    c.rotate(pose.graze * profile.graze + pose.step * 0.025);
    c.scale(
      profile.headX + pose.graze * 0.35,
      profile.headY + pose.graze * 0.2,
    );
    const neckPaint = coatGradient(c, coat, -17, 2);
    c.fillStyle = neckPaint;
    c.fill(profile.neck);
    if (horse) {
      c.fillStyle = coat.dark;
      c.fill(paths.mane);
    }
    c.fillStyle = coat.mid;
    c.fill(profile.ears);
    if (goat) {
      c.fillStyle = coat.dark;
      c.fill(paths.goatHorns);
      c.fill(paths.goatBeard);
    }
    if (antlers && species === "deer") {
      c.strokeStyle = coat.dark;
      c.lineWidth = 0.65;
      c.stroke(paths.antlers);
      if (detail) {
        c.strokeStyle = coat.cream;
        c.lineWidth = 0.22;
        c.stroke(paths.antlers);
      }
    }
    c.fillStyle = neckPaint;
    c.fill(profile.head);
    if (fox || boar) {
      c.fillStyle = coat.cream;
      c.fill(fox ? paths.foxBib : paths.boarTusk);
    }
    c.fillStyle = coat.dark;
    c.beginPath();
    c.ellipse(...profile.muzzle, 1.1, 0.65, 0.3, 0, Math.PI * 2);
    c.fill();
    if (detail) {
      c.beginPath();
      c.arc(...profile.eye, 0.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = coat.cream;
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(profile.eye[0], profile.eye[1] + 2.5);
      c.lineTo(profile.muzzle[0] - 1, profile.muzzle[1] + 0.3);
      c.stroke();
    }
    c.restore();
    c.restore();
  };
}
