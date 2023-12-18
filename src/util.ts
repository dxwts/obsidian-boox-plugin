import UPNG from "src/UPNG.js";

export function generateCharcoal(points: any) {
	return new Promise(function (resolve, reject) {
		const width = points[0].width;
		const height = points[0].height;
		const left = points[0].x;
		const top = points[0].y;
		if (!width || !height) {
			resolve(null);
			return;
		}

		const buf = UPNG.encode([points[0].data], width, height, 0);

		const blob = new Blob([buf], { type: "image/png" });
		const url = URL.createObjectURL(blob);
		const img = document.createElement("img");
		img.onload = function () {
			const res = {
				width,
				height,
				img,
				left,
				top,
				url,
			};
			resolve(res);
		};
		img.onerror = function () {
			console.log("=== error url: ", url);
			reject("load image error");
		};
		img.src = url;
	});
}

export function ARGBToAGBR(color: any) {
	if (!color) {
		return "";
	}
	const bigint = color;
	const a = (bigint >> 24) & 255;
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

export function distance(x1, y1, x2, y2) {
	return Math.hypot(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function calculateTrapezoidPoints(downPoint, upPoint) {
	const distance = upPoint.x - downPoint.x;
	const topLeft = { x: downPoint.x - distance / 2, y: downPoint.y };
	const topRight = { x: downPoint.x + distance / 2, y: downPoint.y };
	const bottomLeft = { x: downPoint.x - distance, y: upPoint.y };
	const bottomRight = { x: upPoint.x, y: upPoint.y };
	const points = [topLeft, topRight, bottomRight, bottomLeft];
	return points;
}

export function calculatePolygonPoints(downPoint, upPoint, sideNum) {
	const centerPoint = {
		x: downPoint.x,
		y: (downPoint.y + upPoint.y) / 2,
	};
	const radius = distance(centerPoint.x, centerPoint.y, upPoint.x, upPoint.y);
	const sideAngle = 360 / sideNum;

	const points = [];
	for (let i = 0; i < sideNum; i++) {
		points.push(getPolygonPointF(centerPoint, radius, sideAngle, i));
	}
	return points;
}

export function getPolygonPointF(
	centerPoint: any,
	radius: number,
	sideAngle: any,
	index: number
  ) {
	const tmpX = sin(radius, sideAngle * index)
	const tmpY = cos(radius, sideAngle * index)
	return {
		x: tmpX + centerPoint.x,
		y: -tmpY + centerPoint.y
	}
  }
  
  export function sin (radius: number, angle: number) {
	return Math.sin(angleToRadian(angle)) * radius
  }
  
  export function cos (radius: number, angle: number) {
	return Math.cos(angleToRadian(angle)) * radius
  }
  
  export function angleToRadian (angle: number) {
	return (angle * Math.PI) / 180
  }

// export function calculateTrianglePoints(downPoint, upPoint) {
// 	const topPoint = {
// 		x: downPoint.x,
// 		y: downPoint.y,
// 	};
// 	const bottomPoint1 = {
// 		x: upPoint.x,
// 		y: upPoint.y,
// 	};
// 	const bottomPoint2 = {
// 		x: downPoint.x - (upPoint.x - downPoint.x),
// 		y: upPoint.y,
// 	};
// 	return [topPoint, bottomPoint1, bottomPoint2];
// }

export function calculateTrianglePoints(downPoint, upPoint) {
	const points = []
	points.push({ x: downPoint.x, y: downPoint.y })
	points.push({ x: upPoint.x, y: upPoint.y })
	points.push({ x: Math.abs(2 * downPoint.x - upPoint.x), y: upPoint.y })
	return points
}
