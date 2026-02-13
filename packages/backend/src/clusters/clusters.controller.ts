import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { UUID } from 'node:crypto';
import { ClustersService } from './clusters.service.js';
import { GetClusterZodDto } from './dto/get-cluster.dto.js';
import { GetClusterLogsZodDto } from './dto/get-cluster-logs.dto.js';
import { GetClusterStatsZodDto } from './dto/get-cluster-stats.dto.js';

@ApiTags('Clusters')
@Controller('clusters')
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  @Get()
  @ApiOkResponse({
    description: 'The list of clusters.',
    type: GetClusterZodDto,
    isArray: true,
  })
  findAll() {
    return this.clustersService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'The cluster based on the given ID.',
    type: GetClusterZodDto,
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  findOne(@Param('id') id: UUID) {
    return this.clustersService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been deleted.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async remove(@Param('id') id: UUID) {
    await this.clustersService.remove(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is starting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async start(@Param('id') id: UUID) {
    await this.clustersService.start(id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been stopped.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async stop(@Param('id') id: UUID) {
    await this.clustersService.stop(id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is restarting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async restart(@Param('id') id: UUID) {
    await this.clustersService.restart(id);
  }

  @Get(':id/logs')
  @ApiProduces('text/plain')
  @ApiOkResponse({
    type: String,
    description: 'The logs of the cluster.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async getLogs(@Param('id') id: UUID, @Query() query: GetClusterLogsZodDto) {
    return await this.clustersService.logs(
      id,
      query.since ? new Date(query.since) : undefined,
      query.until ? new Date(query.until) : undefined,
      query.tail,
    );
  }

  @Get(':id/stats')
  @ApiOkResponse({
    type: GetClusterStatsZodDto,
    description: 'The stats of the cluster.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async getStats(@Param('id') id: UUID) {
    return await this.clustersService.stats(id);
  }
}
