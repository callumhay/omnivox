

using System;
using System.Collections.Generic;
using System.IO.Ports;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

using UnityEngine;

namespace Omnivox {

    [ExecuteInEditMode]
    public class SerialServer : MonoBehaviour {
        private const int DEFAULT_TEENSY_USB_SERIAL_BAUD = 9600;
        private const int DEFAULT_TEENSY_HW_SERIAL_BAUD = 3000000;
        private const int SERIAL_POLLING_INTERVAL_MS = 5000;
        

        private struct SlaveData {
            public int Id { get; set; }
        }

        [SerializeField] private bool _enableSerialPolling = true;
        [SerializeField, Range(1,8)] private int _maxSerialConnections = 4;

        // Voxel Model
        private VoxelModel _voxelModel;

        // Serial port state
        private readonly List<SerialPort> _connectedSerialPorts = new();
        private readonly Dictionary<string, SlaveData> _slaveDataMap = new();
        private CancellationTokenSource _pollingCancellationToken;

        // Port thread -> Main thread communication
        private readonly Queue<Action> _executionQueue = new();
        private readonly object _portThreadSyncLock = new();




        public bool AreSlavesConnected() => _slaveDataMap.Count >= 2;

        private void InitComponentRefs() {
            _voxelModel = FindFirstObjectByType<VoxelModel>();
            if (_voxelModel == null) {
                // Build a new game object with a voxel model component
                GameObject gameObject = new("VoxelModel");
                gameObject.transform.SetParent(null);
                gameObject.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
                gameObject.transform.localScale = Vector3.one;
                _voxelModel = gameObject.AddComponent<VoxelModel>();
            }
        }

        #region Serial Polling
        public void StartSerialPolling() {
            if (!_enableSerialPolling) { return; }
            _pollingCancellationToken = new CancellationTokenSource();
            Task.Run(() => SerialPortPollingTask(_pollingCancellationToken.Token));
        }

        public void StopSerialPolling() {
            if (_pollingCancellationToken != null) {
                _pollingCancellationToken.Cancel();
                _pollingCancellationToken = null;
            }
        }

        private async Task SerialPortPollingTask(CancellationToken cancellationToken) {
            while (!cancellationToken.IsCancellationRequested) {
                try {
                    // Only poll for new ports if we haven't reached the maximum
                    if (_connectedSerialPorts.Count < _maxSerialConnections) {
                        PollForSerialPorts();
                    }
                }
                catch (Exception e) {
                    Debug.LogError($"Serial port polling error: {e.Message}\n{e.StackTrace}");

                    // Reset all serial ports in case of error
                    lock (_connectedSerialPorts) {
                        CloseAllSerialPorts();
                    }
                }

                // Wait before polling again
                await Task.Delay(SERIAL_POLLING_INTERVAL_MS, cancellationToken);
            }
        }

        private void PollForSerialPorts() {
            static bool PortMatchesPattern(string portName, string pattern) {
                return portName.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0;
            }

            // Get all available serial ports
            var availablePorts = SerialPort.GetPortNames();
            
            // Lock to prevent concurrent modification of the serial ports list
            lock (_connectedSerialPorts) {
                foreach (var portName in availablePorts) {
                    // Skip if we're already connected to this port
                    if (_connectedSerialPorts.Any(port => port.PortName == portName)) {
                        continue;
                    }

                    // Determine port type based on name patterns
                    bool isDebugSerial = 
                        PortMatchesPattern(portName, "PJRC") || 
                        PortMatchesPattern(portName, "Teensy");

                    bool isDataSerial = 
                        PortMatchesPattern(portName, "COM") || 
                        PortMatchesPattern(portName, "FTDI") ||
                        PortMatchesPattern(portName, "tty.usbserial");

                    if (isDebugSerial || isDataSerial) {
                        try {
                            // Configure the appropriate port type
                            SerialPort newSerialPort = new(portName) {
                                ReadTimeout = 1000,
                                WriteTimeout = 1000
                            };

                            if (isDebugSerial) {
                                Debug.Log($"Attempting connection with debug/info serial port '{portName}'...");
                                newSerialPort.BaudRate = DEFAULT_TEENSY_USB_SERIAL_BAUD;
                            }
                            else if (isDataSerial) {
                                Debug.Log($"Attempting connection with data streaming serial port '{portName}'...");
                                newSerialPort.BaudRate = DEFAULT_TEENSY_HW_SERIAL_BAUD;
                                newSerialPort.Handshake = Handshake.RequestToSend;
                            }

                            // Set up the port and open it
                            ConfigureAndOpenPort(newSerialPort, isDataSerial);
                        }
                        catch (Exception e) {
                            Debug.LogError($"Failed to open serial port '{portName}': {e.Message}");
                        }
                    }
                }
            }
        }

        private void ConfigureAndOpenPort(SerialPort serialPort, bool isDataPort) {
            try {
                // Open the port
                serialPort.Open();

                if (serialPort.IsOpen) {
                    Debug.Log($"Now connected to port '{serialPort.PortName}' @{serialPort.BaudRate} baud");
                    
                    // Set up data received event handler
                    serialPort.DataReceived += OnSerialDataReceived;
                    
                    // Add to connected ports list
                    _connectedSerialPorts.Add(serialPort);
                    // For data serial ports, send welcome packet
                    if (isDataPort) {
                        SendWelcomePacket(serialPort);
                    }
                }
            }
            catch (Exception e) {
                Debug.LogError($"Failed to configure and open port {serialPort.PortName}: {e.Message}");
                try {
                    if (serialPort.IsOpen) {
                        serialPort.Close();
                    }
                }
                catch {}
            }
        }
        #endregion

        #region Serial Send/Receive
        private void SendWelcomePacket(SerialPort port) {
            try {
                var welcomePacket = VoxelProtocol.BuildWelcomePacketForSlaves(_voxelModel, 255);
                SendCobsEncodedPacket(port, welcomePacket);
                Debug.Log($"Sent welcome packet to {port.PortName}");
            }
            catch (Exception e) {
                Debug.LogError($"Failed to send welcome packet: {e.Message}");
            }
        }

        private void ProcessSerialData(SerialPort serialPort, string data) {
            bool isDataSerial = serialPort.BaudRate == DEFAULT_TEENSY_HW_SERIAL_BAUD;
            
            if (isDataSerial) {
                // Process data from data serial port (looking for slave ID)
                var slaveInfoMatch = Regex.Match(data, @"SLAVE_ID (\d)");

                if (slaveInfoMatch.Success) {
                    if (!_slaveDataMap.ContainsKey(serialPort.PortName)) {
                        int slaveId = int.Parse(slaveInfoMatch.Groups[1].Value);
                        var slaveDataObj = new SlaveData { Id = slaveId };
                        _slaveDataMap[serialPort.PortName] = slaveDataObj;

                        Debug.Log($"Slave ID at {serialPort.PortName} = {slaveId}");
                        Debug.Log($"Sending welcome packet to {serialPort.PortName}...");

                        var welcomePacket = VoxelProtocol.BuildWelcomePacketForSlaves(_voxelModel, slaveId);
                        SendCobsEncodedPacket(serialPort, welcomePacket);
                    }
                    else
                    {
                        int slaveId = int.Parse(slaveInfoMatch.Groups[1].Value);
                        var slaveData = _slaveDataMap[serialPort.PortName];
                        if (slaveData.Id != slaveId) {
                            Debug.Log($"Slave ID changed at {serialPort.PortName} from {slaveData.Id} to {slaveId}");
                        }
                        // Update the slave ID in the map
                        slaveData.Id = slaveId;
                        _slaveDataMap[serialPort.PortName] = slaveData;

                        // Could trigger events for UI or other components about slave connection
                        // e.g., EventSystem.TriggerEvent("SlaveConnected", slaveId);
                    }
                }
            }
            else {
                // Debug/info serial port - just log the data
                Debug.Log($"Serial Debug:\n{data}");
            }
        }

        // IMPORTANT: This executes on a background thread!
        private void OnSerialDataReceived(object sender, SerialDataReceivedEventArgs e) {
            SerialPort serialPort = (SerialPort)sender;
            
            try {
                // Read a line of data (assumes data is line-terminated)
                string data = serialPort.ReadLine();
                
                // Process the received data
                if (!string.IsNullOrEmpty(data)) {
                    // Use the main thread to process data
                    EnqueueSerialDataProcessing(() => {
                        ProcessSerialData(serialPort, data);
                    });
                }
            }
            catch (TimeoutException) {
                // Timeout is normal, ignore
            }
            catch (Exception ex) {
                Debug.LogError($"Error reading from serial port {serialPort.PortName}: {ex.Message}");
                
                // Close problematic port
                RemoveSerialPort(serialPort);
            }
        }

        private void SendCobsEncodedPacket(SerialPort port, byte[] packet) {
            if (!port.IsOpen) { return; }
            try {
                var encoded = COBS.NET.COBS.Encode(packet);
                port.Write(encoded, 0, encoded.Length);
            }
            catch (Exception e) {
                Debug.LogError($"Error sending data to {port.PortName}: {e.Message}");
                RemoveSerialPort(port);
            }
        }
        #endregion

        #region Serial Thread Queueing
        private void EnqueueSerialDataProcessing(Action action) {
            lock (_portThreadSyncLock) {
                _executionQueue.Enqueue(action);
            }
        }
        private void ProcessSerialDataFromQueue() {
            lock (_portThreadSyncLock) {
                while (_executionQueue.Count > 0) {
                    _executionQueue.Dequeue().Invoke();
                }
            }
        }
        #endregion

        #region Serial Port Management
        private void RemoveSerialPort(SerialPort port) {
            try {
                port.DataReceived -= OnSerialDataReceived;
                
                if (port.IsOpen) { port.Close(); }
                    
                lock (_connectedSerialPorts) {
                    _connectedSerialPorts.Remove(port);
                }
                
                _slaveDataMap.Remove(port.PortName);
                Debug.Log($"Removed serial port: {port.PortName}");
            }
            catch (Exception e) {
                Debug.LogError($"Error removing port {port.PortName}: {e.Message}");
            }
        }

        private void CloseAllSerialPorts() {
            lock (_connectedSerialPorts) {
                foreach (var port in _connectedSerialPorts) {
                    try {
                        if (port.IsOpen) { port.Close(); }
                    }
                    catch (Exception) {
                        // Ignore errors during cleanup
                    }
                }
                _connectedSerialPorts.Clear();
                _slaveDataMap.Clear();
            }
        }
        #endregion


        #region Unity Lifecycle
        private void Awake() {
            InitComponentRefs();
        }

        private void OnEnable() {
            if (!Application.isPlaying) {
                InitComponentRefs();
            }
            StartSerialPolling();
        }

        private void OnDisable() {
            StopSerialPolling();
        }

        private void OnDestroy() {
            CloseAllSerialPorts();
        }

        private void OnApplicationQuit() {
            CloseAllSerialPorts();
        }

        private void Update() {
            // Execute queued actions on the main thread (these are enqueued from the serial port thread(s))
            ProcessSerialDataFromQueue();
        }

        #endregion




    }

}