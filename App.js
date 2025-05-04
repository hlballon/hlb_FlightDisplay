import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, Dimensions, Button, ScrollView } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect } from 'react-native-svg';

const LOG_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/temp.jsonl';
const WEATHER_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/temp_w.txt';
const MAX_POINTS_ACC = 60;
const MAX_POINTS_ALT = 10000;
const time_factor = 10;   // times to accelerate replay
const ALT_MIN = 0;
const ALT_MAX = 1500;
const OMIT_POINTS = 10;  // omit "OMIT_POINTS" to display less points

// ScatterPlot component
const ScatterPlot = ({ data, width, height, xTitle, yTitle, xField, yField, yMin, yMax, weatherData, showWeather }) => {
  const padding = 20;
  const leftPadding = 30;
  const max_acc = 0.05;

  console.log(`ScatterPlot ${yTitle}: data length=${data.length}, showWeather=${showWeather}, weatherData length=${weatherData ? weatherData.length : 0}`);

  if (data.length === 0 && (!showWeather || !weatherData || weatherData.length === 0)) {
    return <Text>No data available for {yTitle}</Text>;
  }

  // Filter sensor data to include only every OMIT_POINTSth point for altitude plots
  const filteredData = yField === 'altitude' ? data.filter((_, index) => index % OMIT_POINTS === 0) : data;

  const xValues = data.map(point => point[xField]); // Use unfiltered data for axis scaling
  const weatherXValues = showWeather && weatherData ? weatherData.map(point => point[xField]) : [];
  const allXValues = [...xValues, ...weatherXValues];
  const xMin = allXValues.length > 0 ? Math.min(...allXValues) : 0;
  const xMax = allXValues.length > 0 ? Math.max(...allXValues) : 1;
  const xRange = xMax - xMin;

  let yTickFormat;
  if (yTitle === "Accel (m/s²)") {
    yMin = yMin ?? -max_acc;
    yMax = yMax ?? max_acc;
    yTickFormat = (tick) => tick.toFixed(3);
  } else {
    yMin = yMin ?? ALT_MIN;
    yMax = yMax ?? ALT_MAX;
    yTickFormat = (tick) => tick.toFixed(0);
  }
  const yRange = yMax - yMin;

  const xScale = (x) => (xRange === 0 ? (width - leftPadding - padding) / 2 + leftPadding : leftPadding + ((x - xMin) / xRange) * (width - leftPadding - padding));
  const yScale = (y) => (yRange === 0 ? height / 2 : height - padding - ((y - yMin) / yRange) * (height - 2 * padding));

  const xAxisY = yScale(yTitle === "Accel (m/s²)" ? 0 : yMin);
  const yAxisX = xScale(xMin);

  const xTicks = xRange === 0 ? [xMin] : Array.from({ length: 3 }, (_, i) => xMin + (i * xRange) / 2);
  const yTicks = yRange === 0 ? [yMin] : Array.from({ length: 5 }, (_, i) => yMin + (i * yRange) / 4);

  const yAxisTitlePosition = 180;
  const overlapThreshold = 10;

  return (
    <View style={styles.chartWrapper}>
      <Text style={styles.yAxisTitle}>{yTitle}</Text>
      <Svg width={width} height={height}>
        <Rect x={leftPadding} y={padding} width={width - leftPadding - padding} height={height - 2 * padding} fill="none" stroke="black" strokeWidth="1" />
        <Line x1={leftPadding} y1={xAxisY} x2={width - padding} y2={xAxisY} stroke="black" strokeWidth="1" />
        <Line x1={yAxisX} y1={padding} x2={yAxisX} y2={height - padding} stroke="black" strokeWidth="1" />
        {xTicks.map((tick, index) => (
          <SvgText
            key={`x-${tick}-${index}`}
            x={xScale(tick)}
            y={xAxisY + 15}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {Math.round(tick)}
          </SvgText>
        ))}
        {yTicks.map((tick, index) => {
          const tickYPosition = yScale(tick) + 3;
          if (Math.abs(tickYPosition - yAxisTitlePosition) < overlapThreshold) {
            return null;
          }
          return (
            <SvgText
              key={`y-${tick}-${index}`}
              x={yAxisX - 15}
              y={tickYPosition}
              fontSize="8"
              fontWeight="bold"
              textAnchor="end"
            >
              {yTickFormat(tick)}
            </SvgText>
          );
        })}
        {filteredData.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={xScale(point[xField])}
            cy={yScale(point[yField])}
            r={3}
            fill="rgba(255, 99, 132, 1)"
            stroke="black"
            strokeWidth="1.5"
          />
        ))}
        {showWeather && weatherData && weatherData.map((point, index) => (
          <Circle
            key={`weather-${index}`}
            cx={xScale(point[xField])}
            cy={yScale(point[yField])}
            r={3}
            fill="green"
            stroke="black"
            strokeWidth="1.5"
          />
        ))}
      </Svg>
      <Text style={styles.xAxisTitle}>{xTitle}</Text>
    </View>
  );
};

// Memoized PolarPlot component
const PolarPlot = React.memo(({ data, weatherData, showWeather, width, height, title, altitudeMin, altitudeMax }) => {
  const radius = Math.min(width, height) / 2 - 20;
  const centerX = width / 2;
  const centerY = height / 2;

  console.log(`PolarPlot: data length=${data.length}, showWeather=${showWeather}, weatherData length=${weatherData ? weatherData.length : 0}`);

  if (data.length === 0 && (!showWeather || !weatherData || weatherData.length === 0)) {
    return <Text>No data available for {title || "Direction vs Altitude"}</Text>;
  }

  const altitudes = [...(showWeather && weatherData ? weatherData.map(point => point.altitude) : []), ...data.map(point => point.altitude)];
  const minAltitude = altitudeMin ?? (altitudes.length > 0 ? Math.min(...altitudes) : ALT_MIN);
  const maxAltitude = altitudeMax ?? (altitudes.length > 0 ? Math.max(...altitudes) : ALT_MAX);
  const altitudeRange = maxAltitude - minAltitude || 1;

  const scaleAltitude = (altitude) => ((altitude - minAltitude) / altitudeRange) * radius;

  const plotPoints = (points, color, prefix, applyFilter = false) => {
    // Apply filtering only if specified (for sensor data)
    const filteredPoints = applyFilter ? points.filter((_, index) => index % OMIT_POINTS === 0) : points;
    return filteredPoints.map((point, index) => {
      const angle = ((point.direction - 90) * Math.PI) / 180;
      const r = scaleAltitude(point.altitude);
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return (
        <Circle
          key={`${prefix}-${index}`}
          cx={x}
          cy={y}
          r={3}
          fill={color}
          stroke="black"
          strokeWidth="1.5"
        />
      );
    });
  };

  const altitudeLabels = [0.25, 0.5, 0.75, 1].map(fraction => {
    const altitude = minAltitude + fraction * altitudeRange;
    return altitude.toFixed(0);
  });

  return (
    <View style={styles.chartWrapper}>
      <Text style={styles.title}>{title || "Direction vs Altitude"}</Text>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75, 1].map((fraction, index) => {
          const r = fraction * radius;
          const altitude = altitudeLabels[index];
          return (
            <React.Fragment key={`ring-${index}`}>
              <Circle cx={centerX} cy={centerY} r={r} stroke="gray" strokeWidth="0.5" fill="none" />
              <SvgText
                x={centerX + r + 5}
                y={centerY}
                fontSize="8"
                fontWeight="bold"
                textAnchor="start"
              >
                {altitude} m
              </SvgText>
            </React.Fragment>
          );
        })}
        {[0, 90, 180, 270].map((angle) => {
          const displayAngle = (angle + 90) % 360;
          const rad = (angle * Math.PI) / 180;
          const x = centerX + radius * Math.cos(rad);
          const y = centerY + radius * Math.sin(rad);
          return (
            <SvgText
              key={`label-${angle}`}
              x={x}
              y={y}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              dy={angle === 90 || angle === 270 ? 3 : 0}
            >
              {displayAngle}°
            </SvgText>
          );
        })}
        {showWeather && weatherData && plotPoints(weatherData, "green", "weather", false)}
        {plotPoints(data, "rgba(255, 99, 132, 1)", "sensor", true)}
      </Svg>
      <Text style={styles.xAxisTitle}>Direction (°) vs Altitude (m)</Text>
    </View>
  );
});

export default function App() {
  const [latestAltitude, setLatestAltitude] = useState(0);
  const [latestVSpeed, setLatestVSpeed] = useState(0);
  const [latestAcceleration, setLatestAcceleration] = useState(0);
  const [latestDirection, setLatestDirection] = useState(0);
  const [latestSpeed, setLatestSpeed] = useState(0);
  const [latestTemperature, setLatestTemperature] = useState(0);
  const [latestHumidity, setLatestHumidity] = useState(0);
  const [latestGpsDateTime, setLatestGpsDateTime] = useState('');
  const [vSpeedData, setVSpeedData] = useState([]);
  const [accelerationData, setAccelerationData] = useState([]);
  const [directionData, setDirectionData] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [logData, setLogData] = useState([]);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [weatherData, setWeatherData] = useState([]);
  const [showWeatherData, setShowWeatherData] = useState(false);

  // Fetch log data
  useEffect(() => {
    const fetchLogData = async () => {
      try {
        const response = await fetch(LOG_FILE_URL);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const data = lines.map(line => {
          const point = JSON.parse(line);
          return {
            Runtime: parseFloat(point.Runtime) || 0,
            Baro_Alt_m: parseFloat(point.Baro_Alt_m) || 0,
            VAR_Kal_m_s: parseFloat(point.VAR_Kal_m_s) || 0,
            meanACC_Kal_m_s2: parseFloat(point.meanACC_Kal_m_s2) || 0,
            HDG_deg: parseFloat(point.HDG_deg) || 0,
            GS_kt: parseFloat(point.GS_kt) || 0,
            Envelope_Temp_Deg: parseFloat(point.Envelope_Temp_Deg) || 0,
            varioVar_m_s: parseFloat(point.varioVar_m_s) || 0,
            Date: point.Date || '',
            Time: point.Time || '',
          };
        }).filter(point => !isNaN(point.Runtime) && !isNaN(point.Baro_Alt_m));
        console.log('Parsed log data:', data.slice(0, 5));
        setLogData(data.sort((a, b) => a.Runtime - b.Runtime));
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching log data:', err);
        setLogData([]);
        setFetchError('Failed to fetch log data.');
      }
    };
    fetchLogData();
  }, []);

  // Fetch weather data when showWeatherData is true
  useEffect(() => {
    if (showWeatherData) {
      const fetchWeatherData = async () => {
        try {
          console.log('Fetching weather data from:', WEATHER_FILE_URL);
          const response = await fetch(WEATHER_FILE_URL);
          if (!response.ok) throw new Error(`HTTP error ${response.status}`);
          const text = await response.text();
          console.log('Raw weather data:', text);

          const lines = text.split('\n').filter(line => line.trim() !== '');
          const headers = lines[0].split(/\s+/).map(h => h.trim());

          const headerMapping = {
            'h(mAMSL)': 'altitude',
            'T(°C)': 'temperature',
            'Spd(kt)': 'speed',
            'RH(%)': 'humidity',
            'Dir(°)': 'direction',
            'p(hPa)': 'pressure',
            'Dew(°C)': 'dewPoint'
          };

          const data = lines.slice(1).map(line => {
            const values = line.split(/\s+/).map(v => v.trim());
            if (values.length !== headers.length) {
              console.warn('Mismatch in number of columns for line:', line);
              return null;
            }
            return headers.reduce((obj, header, index) => {
              const key = headerMapping[header] || header;
              let value = parseFloat(values[index]);
              // Adjust wind direction to balloon heading (wind from + 180°)
              if (key === 'direction') {
                value = (value + 180) % 360;
              }
              obj[key] = isNaN(value) ? values[index] : value;
              return obj;
            }, {});
          }).filter(point => point !== null && point.altitude >= ALT_MIN && point.altitude <= ALT_MAX);

          console.log('Parsed weather data:', data.slice(0, 5));
          setWeatherData(data);
          setFetchError(null);
        } catch (err) {
          console.error('Error fetching weather data:', err);
          setWeatherData([]);
          setFetchError('Failed to fetch weather data.');
        }
      };
      fetchWeatherData();
    } else {
      setWeatherData([]);
    }
  }, [showWeatherData]);

  // Toggle replay mode
  const toggleReplayMode = useCallback(() => {
    setIsReplayMode(prev => !prev);
    setIsPaused(false);
    setVSpeedData([]);
    setAccelerationData([]);
    setDirectionData([]);
    setSpeedData([]);
    setTemperatureData([]);
    setHumidityData([]);
    setLatestAltitude(0);
    setLatestVSpeed(0);
    setLatestAcceleration(0);
    setLatestDirection(0);
    setLatestSpeed(0);
    setLatestTemperature(0);
    setLatestHumidity(0);
    setLatestGpsDateTime('');
    setFetchError(null); // Clear any previous fetch errors
  }, []);

  // Toggle weather data display
  const toggleWeatherData = useCallback(() => {
    console.log('Toggling showWeatherData to:', !showWeatherData);
    setShowWeatherData(prev => !prev);
  }, [showWeatherData]);

  // Pause/Continue replay
  const pauseReplay = useCallback(() => setIsPaused(true), []);
  const continueReplay = useCallback(() => setIsPaused(false), []);

  // Fetch live data
  useEffect(() => {
    if (!isReplayMode) {
      const startTime = Date.now();
      const controller = new AbortController();
      const intervalId = setInterval(async () => {
        try {
          console.log('Attempting to fetch live data from http://192.168.4.1/readings');
          const response = await fetch('http://192.168.4.1/readings', {
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          const data = await response.json();
          console.log('Fetched live data:', data);

          // Construct gpsDateTime from individual fields
          const gpsDateTime = `20${data.gpsYear}-${data.gpsMon.padStart(2, '0')}-${data.gpsDay.padStart(2, '0')} ${data.gpsStd.padStart(2, '0')}:${data.gpsMin.padStart(2, '0')}:${data.gpsSek.padStart(2, '0')}`;

          const altitude = parseFloat(data.calt) || 0;
          const vSpeed = parseFloat(data.cvario) || 0;
          const acceleration = parseFloat(data.cacc) || 0;
          const direction = parseFloat(data.gpsAngle) || 0;
          const speed = parseFloat(data.gpsSpeed) || 0;
          const temperature = parseFloat(data.tbt) || 0; // Fixed typo: lbt -> tbt
          const humidity = parseFloat(data.lbc) || 0;

          // Validate data
          if (isNaN(altitude) || isNaN(vSpeed) || isNaN(acceleration) || isNaN(direction) || isNaN(speed) || isNaN(temperature) || isNaN(humidity)) {
            console.warn('Invalid data received:', { altitude, vSpeed, acceleration, direction, speed, temperature, humidity });
            return;
          }

          if (altitude >= ALT_MIN && altitude <= ALT_MAX) {
            setLatestAltitude(altitude);
            setLatestVSpeed(vSpeed);
            setLatestAcceleration(acceleration);
            setLatestDirection(direction);
            setLatestSpeed(speed);
            setLatestTemperature(temperature);
            setLatestHumidity(humidity);
            setLatestGpsDateTime(gpsDateTime);

            const elapsedTime = (Date.now() - startTime) / 1000;

            // Update diagram data consistently with replay mode
            setVSpeedData(prev => {
              const newData = [...prev, { time: elapsedTime, vSpeed }].slice(-MAX_POINTS_ALT);
              console.log('Updated vSpeedData:', newData.slice(-5));
              return newData;
            });
            setAccelerationData(prev => {
              const newData = [...prev, { time: elapsedTime, acceleration }].slice(-MAX_POINTS_ACC);
              console.log('Updated accelerationData:', newData.slice(-5));
              return newData;
            });
            setDirectionData(prev => {
              const newData = [...prev, { time: elapsedTime, direction, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated directionData:', newData.slice(-5));
              return newData;
            });
            setSpeedData(prev => {
              const newData = [...prev, { time: elapsedTime, speed, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated speedData:', newData.slice(-5));
              return newData;
            });
            setTemperatureData(prev => {
              const newData = [...prev, { time: elapsedTime, temperature, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated temperatureData:', newData.slice(-5));
              return newData;
            });
            setHumidityData(prev => {
              const newData = [...prev, { time: elapsedTime, humidity, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated humidityData:', newData.slice(-5));
              return newData;
            });

            setFetchError(null); // Clear any previous errors on successful fetch
          } else {
            console.warn(`Altitude ${altitude} out of range [${ALT_MIN}, ${ALT_MAX}]`);
          }
        } catch (error) {
          console.error('Failed to fetch readings:', error);
          setFetchError(`Failed to fetch live data: ${error.message}`);
        }
      }, 1000);
      return () => {
        console.log('Cleaning up live data fetch');
        controller.abort();
        clearInterval(intervalId);
      };
    }
  }, [isReplayMode]);

  // Playback log data
  useEffect(() => {
    if (isReplayMode && logData.length > 0 && !isPaused) {
      let index = 0;
      const t0 = logData[0].Runtime || 0;
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        const elapsedMs = Date.now() - startTime;
        const simulatedTime = t0 + (elapsedMs / 1000) * time_factor;

        while (index < logData.length && logData[index].Runtime <= simulatedTime) {
          const point = logData[index];
          const altitude = point.Baro_Alt_m;

          if (altitude >= ALT_MIN && altitude <= ALT_MAX) {
            setVSpeedData(prev => {
              const newData = [...prev, { time: point.Runtime, vSpeed: point.VAR_Kal_m_s }].slice(-MAX_POINTS_ALT);
              console.log('Updated vSpeedData (replay):', newData.slice(-5));
              return newData;
            });
            setAccelerationData(prev => {
              const newData = [...prev, { time: point.Runtime, acceleration: point.meanACC_Kal_m_s2 }].slice(-MAX_POINTS_ACC);
              console.log('Updated accelerationData (replay):', newData.slice(-5));
              return newData;
            });
            setDirectionData(prev => {
              const newData = [...prev, { time: point.Runtime, direction: point.HDG_deg, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated directionData (replay):', newData.slice(-5));
              return newData;
            });
            setSpeedData(prev => {
              const newData = [...prev, { time: point.Runtime, speed: point.GS_kt, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated speedData (replay):', newData.slice(-5));
              return newData;
            });
            setTemperatureData(prev => {
              const newData = [...prev, { time: point.Runtime, temperature: point.Envelope_Temp_Deg, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated temperatureData (replay):', newData.slice(-5));
              return newData;
            });
            setHumidityData(prev => {
              const newData = [...prev, { time: point.Runtime, humidity: point.varioVar_m_s, altitude }].slice(-MAX_POINTS_ALT);
              console.log('Updated humidityData (replay):', newData.slice(-5));
              return newData;
            });

            setLatestAltitude(altitude);
            setLatestVSpeed(point.VAR_Kal_m_s);
            setLatestAcceleration(point.meanACC_Kal_m_s2);
            setLatestDirection(point.HDG_deg);
            setLatestSpeed(point.GS_kt);
            setLatestTemperature(point.Envelope_Temp_Deg);
            setLatestHumidity(point.varioVar_m_s);
            setLatestGpsDateTime(`${point.Date} ${point.Time}`);
          }
          index++;
          console.log(`Replay index: ${index}, Simulated time: ${simulatedTime}, Altitude: ${altitude}`);
        }

        if (index >= logData.length) {
          console.log('Replay completed');
          clearInterval(intervalId);
          setIsReplayMode(false);
          setIsPaused(false);
        }
      }, 100);
      return () => {
        console.log('Cleaning up replay');
        clearInterval(intervalId);
      };
    }
  }, [isReplayMode, isPaused, logData]);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const cellWidth = (screenWidth - 60) / 3;
  const cellHeight = (screenHeight - 100) / 2;

  const diagramWidth = cellWidth;
  const diagramHeight = cellHeight;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.gridRow}>
        <View style={[styles.gridCell, { width: cellWidth }]}>
          <View style={styles.textContent}>
            <Text style={styles.numericTitle}>hlballon Flight Display v:250504</Text>
            <Text style={styles.referenceText}>https://hlballon.com</Text>
            <Text style={styles.gpsDateTime}>GPS Date Time: {latestGpsDateTime}</Text>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Altitude</Text>
              <Text style={styles.value}>{latestAltitude.toFixed(2)}</Text>
              <Text style={styles.unit}>m</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>v_Speed</Text>
              <Text style={styles.value}>{latestVSpeed.toFixed(2)}</Text>
              <Text style={styles.unit}>m/s</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Acceleration</Text>
              <Text style={styles.value}>{latestAcceleration.toFixed(3)}</Text>
              <Text style={styles.unit}>m/s²</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Direction</Text>
              <Text style={styles.value}>{latestDirection.toFixed(2)}</Text>
              <Text style={styles.unit}>°</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Speed</Text>
              <Text style={styles.value}>{latestSpeed.toFixed(2)}</Text>
              <Text style={styles.unit}>kt</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Temperature</Text>
              <Text style={styles.value}>{latestTemperature.toFixed(2)}</Text>
              <Text style={styles.unit}>°C</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Humidity</Text>
              <Text style={styles.value}>{latestHumidity.toFixed(2)}</Text>
              <Text style={styles.unit}>%</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Altitude Min</Text>
              <Text style={styles.value}>{ALT_MIN.toFixed(2)}</Text>
              <Text style={styles.unit}>m</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Altitude Max</Text>
              <Text style={styles.value}>{ALT_MAX.toFixed(2)}</Text>
              <Text style={styles.unit}>m</Text>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <Button
              title={isReplayMode ? "Switch to Live Data" : "Switch to Replay Mode"}
              onPress={toggleReplayMode}
            />
            {isReplayMode && (
              <Button
                title={isPaused ? "Continue" : "Pause"}
                onPress={isPaused ? continueReplay : pauseReplay}
                color="#FFFF00"
              />
            )}
          </View>
          <View style={styles.weatherButtonContainer}>
            <Button
              title={showWeatherData ? "Hide WetterHeidi Upper_Winds" : "WetterHeidi Upper_Winds"}
              onPress={toggleWeatherData}
              color="#006400"
            />
          </View>
        </View>
        <PolarPlot
          data={directionData}
          weatherData={weatherData}
          showWeather={showWeatherData}
          width={diagramWidth}
          height={diagramHeight}
          altitudeMin={ALT_MIN}
          altitudeMax={ALT_MAX}
        />
        <ScatterPlot
          data={temperatureData}
          width={diagramWidth}
          height={diagramHeight}
          xTitle="Temperature (°C)"
          yTitle="Altitude (m)"
          xField="temperature"
          yField="altitude"
          yMin={ALT_MIN}
          yMax={ALT_MAX}
          weatherData={weatherData.map(point => ({ temperature: point.temperature, altitude: point.altitude }))}
          showWeather={showWeatherData}
        />
      </View>
      <View style={styles.gridRow}>
        <ScatterPlot
          data={accelerationData}
          width={diagramWidth}
          height={diagramHeight}
          xTitle="Time (s)"
          yTitle="Accel (m/s²)"
          xField="time"
          yField="acceleration"
          showWeather={false}
        />
        <ScatterPlot
          data={speedData}
          width={diagramWidth}
          height={diagramHeight}
          xTitle="Speed (kt)"
          yTitle="Altitude (m)"
          xField="speed"
          yField="altitude"
          yMin={ALT_MIN}
          yMax={ALT_MAX}
          weatherData={weatherData.map(point => ({ speed: point.speed, altitude: point.altitude }))}
          showWeather={showWeatherData}
        />
        <ScatterPlot
          data={humidityData}
          width={diagramWidth}
          height={diagramHeight}
          xTitle="Humidity (%)"
          yTitle="Altitude (m)"
          xField="humidity"
          yField="altitude"
          yMin={ALT_MIN}
          yMax={ALT_MAX}
          weatherData={weatherData.map(point => ({ humidity: point.humidity, altitude: point.altitude }))}
          showWeather={showWeatherData}
        />
      </View>
      {fetchError && <Text style={styles.errorText}>{fetchError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCell: {
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    borderRadius: 5,
    paddingVertical: 10,
    width: (Dimensions.get('window').width - 60) / 3,
    flex: 1,
  },
  textContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 80, // Add padding to prevent overlap with buttons
  },
  weatherButtonContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 170,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 170,
    alignItems: 'flex-start',
  },
  numericTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  referenceText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  gpsDateTime: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'left',
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    marginVertical: 2,
    width: '100%',
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 16,
    width: 100,
    textAlign: 'left',
  },
  value: {
    fontSize: 16,
    width: 80,
    textAlign: 'right',
  },
  unit: {
    fontSize: 16,
    width: 40,
    textAlign: 'left',
    paddingLeft: 5,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  yAxisTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    transform: [{ rotate: '-90deg' }],
    position: 'absolute',
    left: -50,
    top: 180,
    width: 100,
    textAlign: 'center',
  },
  xAxisTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
});