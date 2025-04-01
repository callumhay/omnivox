# COBS.NET

`COBS.NET` is a simple .NET implementation of the **[Consistent Overhead Byte Stuffing (COBS)](https://en.wikipedia.org/wiki/Consistent_Overhead_Byte_Stuffing)** algorithm.

## Installation

### NuGet Package Manager

```bash
Install-Package COBS.NET
```

### .NET CLI

```bash
dotnet add package COBS.NET
```

## Usage

### Encoding

```csharp
byte[] data = new byte[] { 0x00, 0x01, 0x02, 0x03 };
byte[] encodedData = COBS.Encode(data);
```

### Decoding

```csharp
byte[] data = new byte[] { 0x01, 0x02, 0x03, 0x04, 0x05, 0x00 };
byte[] decodedData = COBS.Decode(data);
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
