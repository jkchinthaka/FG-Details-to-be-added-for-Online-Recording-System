import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export class CreateVehicleDto {
  @ApiProperty({ example: "WP CAB-1234" })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  vehicleNumber!: string;

  @ApiPropertyOptional({ example: "FT-01" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  freezerTruckNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  qrIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transporterId?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  freezerTruckNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  qrIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transporterId?: string;
}

export class SetVehicleQrDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  qrIdentifier!: string;
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export class CreateDriverDto {
  @ApiProperty({ example: "Sunil Perera" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty({ example: "B1234567" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  licenseNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transporterId?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transporterId?: string;
}

// ---------------------------------------------------------------------------
// Transporters
// ---------------------------------------------------------------------------

export class CreateTransporterDto {
  @ApiProperty({ example: "Lanka Cold Logistics" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}

export class UpdateTransporterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
