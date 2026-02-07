import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BotService } from './bot.service.js';
import { CreateBotZodDto } from './dto/create-bot.dto.js';
import { GetBotZodDto } from './dto/get-bot.dto.js';
import { UpdateBotZodDto } from './dto/update-bot.dto.js';

@ApiTags('Bot')
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description:
      'The bot informations have been retrieve correctly and it has been created in database successfully.',
    type: GetBotZodDto,
  })
  @ApiConflictResponse({
    description: 'The bot is already created.',
  })
  create(@Body() createBotDto: CreateBotZodDto) {
    return this.botService.create(createBotDto);
  }

  @Get()
  @ApiOkResponse({
    description: 'The registered bot.',
    type: GetBotZodDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot created beforehand.',
  })
  findOne() {
    return this.botService.findOne();
  }

  @Patch()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Updated bot information.',
    type: GetBotZodDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot to update.',
  })
  update(@Body() updateBotDto: UpdateBotZodDto) {
    return this.botService.update(updateBotDto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The bot is deleted.',
  })
  @ApiNotFoundResponse({
    description: 'No bot to update.',
  })
  async remove() {
    await this.botService.remove();
  }
}
