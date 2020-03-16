#include "MasterClient.h"

#define TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS 1000000 

MasterClient:: MasterClient() : 
  discoveryIP(MULTICAST_ADDR0, MULTICAST_ADDR1, MULTICAST_ADDR2, MULTICAST_ADDR3), 
  udpPort(UDP_PORT), state(DISCOVERING), discoveryPacketTimerMicroSecs(TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS) {
}

MasterClient::~MasterClient() {
}

void MasterClient::run(unsigned long dtMicroSecs) {

  switch (this->state) {
    case MasterClient::DISCOVERING:
      this->discoveryPacketTimerMicroSecs += dtMicroSecs;
      this->sendDiscoveryPacket(dtMicroSecs);
      this->receiveDiscoveryAck();
      break;

    case MasterClient::CONNECTING:
      this->initiateConnectionWithServer();
      break;

    case MasterClient::CONNECTED:
      this->receiveServerPacket();
      break;

    default:
      this->state = MasterClient::DISCOVERING;
      break;
  }
}

void MasterClient::setState(const StateType& nextState) {
  switch (nextState) {
    case MasterClient::DISCOVERING:
      this->discoveryPacketTimerMicroSecs = 0;
      break;

    case MasterClient::CONNECTING:
      break;

    case MasterClient::CONNECTED:
      break;

    default:
      this->state = MasterClient::DISCOVERING;
      return;
  }

  this->state = nextState;
}

void MasterClient::sendDiscoveryPacket(unsigned long dtMicroSecs) {
  if (this->discoveryPacketTimerMicroSecs >= TIME_BETWEEN_DISCOVERY_PACKETS_MICROSECS) {

    Serial.println("Sending discovery packet.");
    this->udp.beginPacket(this->discoveryIP, this->udpPort);
    this->udp.write(DISCOVERY_REQ);
    this->udp.endPacket();

    this->discoveryPacketTimerMicroSecs = 0;
  }
}

void MasterClient::receiveDiscoveryAck() {
  if (this->state != MasterClient::DISCOVERING) {
    return;
  }

  if (this->udp.parsePacket() >= DISCOVERY_ACK_PACKET_MIN_SIZE) {
    Serial.println("UDP Packet received...");

    std::vector<char> tempBuffer;
    tempBuffer.push_back(this->udp.read());
    tempBuffer.push_back(this->udp.read());
    tempBuffer.push_back(this->udp.read());

    std::string tempStr(tempBuffer.begin(), tempBuffer.end());

    Serial.print("Found packet header: ");
    Serial.println(tempStr.c_str());

    if (tempStr == DISCOVERY_ACK) {
      Serial.println("Discovery acknowlegment packet found, reading packet info.");

      // Go through the discovery ack packet and figure out if the ack is for this device
      uint8_t addressParts[4];
      uint16_t readPort;
      if (this->udp.available() && this->udp.read() == ' ') {

        // Read the address
        for (int i = 0; i < 4; i++) {
          this->readUntil(tempBuffer, ' ');
          if (!tempBuffer.empty()) {
            tempStr = std::string(tempBuffer.begin(), tempBuffer.end());
            addressParts[i] = static_cast<uint8_t>(std::atoi(tempStr.c_str()));
          }
          else {
            Serial.println("Poorly formed address in discovery ACK packet.");
            return;
          }
        }

        // Now read the port
        this->readUntil(tempBuffer, ' ');
        if (!tempBuffer.empty()) {
          tempStr = std::string(tempBuffer.begin(), tempBuffer.end());
          readPort = static_cast<uint16_t>(std::atoi(tempStr.c_str()));
        }
        else {
          Serial.println("Poorly formed port in discovery ACK packet.");
          return;
        }

        // We have the address and the port, make sure it's the same as ours
        IPAddress readAddress(addressParts);
        if ((readAddress == WiFi.localIP() || readAddress == Ethernet.localIP()) && readPort == this->udpPort) {

          // Discovery was a success!
          this->serverAddr = this->udp.remoteIP();
          this->serverPort = this->udp.remotePort();
          this->setState(MasterClient::CONNECTING);

          Serial.print("Discovered - Server IP: ");
          Serial.print(this->serverAddr.toString());
          Serial.print(", port: ");
          Serial.println(this->serverPort);
        }
        else {
          Serial.println("Discovery packet address/port mismatch.");
        }
      }
      else {
        // Malformed packet
        Serial.println("Poorly formed discovery ACK packet.");
      }
    }
    else {
      Serial.println("Discovery packet did not have ACK header.");
    }
  }
  else {
    Serial.println("Waiting to be discovered...");
  }
}

void MasterClient::initiateConnectionWithServer() {
  if (this->state != MasterClient::CONNECTING) {
    return;
  }

  if (this->tcp.connect(this->serverAddr, this->serverPort)) {
    this->setState(MasterClient::CONNECTED);
    Serial.print("Connected to server.");
  }
}

void MasterClient::receiveServerPacket() {
  if (this->state != MasterClient::CONNECTED) {
    return;
  }
  if (!this->tcp.connected()) {
    Serial.print("TCP Socket is disconnected, rediscovering server...");
    this->setState(MasterClient::DISCOVERING);
    return;
  }





}