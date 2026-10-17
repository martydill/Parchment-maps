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
  };
  const coats = [
    ["#c5a476", "#9e7950", "#74543b", "#4c4135", "#d3bd96"],
    ["#ae9578", "#897058", "#625344", "#3e3b34", "#cbbda3"],
    ["#a98563", "#826044", "#5c4636", "#39352f", "#c1a780"],
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

  function leg(c, motion, hip, far, rear, pose, coat) {
    hip -= far ? 1.6 : 0;
    const ground = far ? -1.1 : 0;
    const footX = hip + motion.swing;
    const footY = ground - motion.lift;
    const jointX = hip + motion.swing * 0.45 + (rear ? -1.3 : 0.8);
    const jointY = -7 + pose.bob * 0.4;
    c.fillStyle = far ? coat.dark : coat.shade;
    c.beginPath();
    c.moveTo(hip - 1.3, -15 + pose.bob);
    c.quadraticCurveTo(hip - 1.4, -11, jointX - 0.55, jointY);
    c.lineTo(footX - 0.4, footY);
    c.lineTo(footX + 0.6, footY);
    c.lineTo(jointX + 0.65, jointY);
    c.quadraticCurveTo(hip + 2, -11, hip + 1.5, -15 + pose.bob);
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
    { horse = false, antlers = false, variant = 0, detail = true } = {},
  ) {
    const coat = coats[variant % coats.length];
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
    leg(c, pose.legs[0], -8, true, true, pose, coat);
    leg(c, pose.legs[1], 6, true, false, pose, coat);

    c.save();
    c.translate(0, -5 + pose.bob + pose.breath);
    c.save();
    c.translate(-11, -13);
    c.rotate(pose.tail);
    c.translate(11, 13);
    c.fillStyle = horse ? coat.dark : coat.cream;
    c.fill(horse ? paths.horseTail : paths.deerTail);
    c.restore();

    c.fillStyle = coatGradient(c, coat, -18, -5);
    c.fill(paths.body);
    c.fillStyle = coat.shade;
    c.globalAlpha *= 0.22;
    c.fill(paths.belly);
    c.restore();

    leg(c, pose.legs[2], -8, false, true, pose, coat);
    leg(c, pose.legs[3], 6, false, false, pose, coat);
    c.save();
    c.translate(0, -5 + pose.bob + pose.breath);
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
    c.translate(7, -13);
    c.rotate(pose.graze * 1.45 + pose.step * 0.025);
    c.scale(0.8 + pose.graze * 0.35, 0.64 + pose.graze * 0.2);
    const neckPaint = coatGradient(c, coat, -17, 2);
    c.fillStyle = neckPaint;
    c.fill(horse ? paths.horseNeck : paths.deerNeck);
    if (horse) {
      c.fillStyle = coat.dark;
      c.fill(paths.mane);
    }
    c.fillStyle = coat.mid;
    c.fill(horse ? paths.horseEars : paths.deerEars);
    if (antlers) {
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
    c.fill(horse ? paths.horseHead : paths.deerHead);
    c.fillStyle = coat.dark;
    c.beginPath();
    c.ellipse(
      horse ? 13.5 : 14,
      horse ? -8 : -12,
      1.1,
      0.65,
      0.3,
      0,
      Math.PI * 2,
    );
    c.fill();
    if (detail) {
      c.beginPath();
      c.arc(8.5, -15.2, 0.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = coat.cream;
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(8, -12.5);
      c.lineTo(horse ? 12 : 13, horse ? -9 : -11.7);
      c.stroke();
    }
    c.restore();
    c.restore();
  };
}
